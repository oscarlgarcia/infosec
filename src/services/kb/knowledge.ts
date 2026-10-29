import * as fs from 'fs/promises';
import * as path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import * as cheerio from 'cheerio';
import { DocumentModel } from '../../db/mongo/models';
import { getChromaClient } from '../chroma/indexer';
import { createProviderEmbedding, createProviderEmbeddings } from '../llm/openai';
import type { Department, Document as DocType, SearchResult } from '../../types';

const CHROMA_COLLECTION = 'infosec-kb';
const KNOWLEDGE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'knowledge');

const CHUNK_MAX_CHARS = 6000;
const CHUNK_OVERLAP_CHARS = 600;

function chunkText(text: string, maxChars: number = CHUNK_MAX_CHARS, overlap: number = CHUNK_OVERLAP_CHARS): string[] {
  if (!text) return [];
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + maxChars, cleaned.length);
    if (end < cleaned.length) {
      const searchStart = Math.max(start, end - 600);
      const newlineBreak = cleaned.lastIndexOf('\n', end);
      const sentenceBreak = Math.max(
        cleaned.lastIndexOf('. ', end),
        cleaned.lastIndexOf('; ', end),
        cleaned.lastIndexOf('): ', end)
      );
      const boundary = Math.max(newlineBreak, sentenceBreak);
      if (boundary > searchStart) {
        end = boundary + 1;
      }
    }
    const chunk = cleaned.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= cleaned.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export async function parseDocument(
  filePath: string,
  mimeType: string
): Promise<string> {
  const buffer = await fs.readFile(filePath);

  switch (mimeType) {
    case 'text/plain':
      return buffer.toString('utf-8');
    
    case 'application/pdf':
      return (await pdf(buffer)).text;
    
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return (await mammoth.extractRawText({ buffer })).value;
    
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let text = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += xlsx.utils.sheet_to_csv(sheet) + '\n';
      }
      return text;
    }
    
    case 'text/html': {
      const $ = cheerio.load(buffer.toString());
      return $('body').text();
    }
    
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.html': 'text/html',
    '.htm': 'text/html',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function uploadDocument(
  filePath: string,
  originalName: string,
  department: Department
): Promise<DocType> {
  const mimeType = getMimeType(originalName);
  const content = await parseDocument(filePath, mimeType);
  
  const filename = `${Date.now()}-${originalName}`;
  const stats = await fs.stat(filePath);
  
  await fs.mkdir(KNOWLEDGE_UPLOAD_DIR, { recursive: true });
  const destPath = path.join(KNOWLEDGE_UPLOAD_DIR, filename);
  await fs.copyFile(filePath, destPath);

  let embedding: number[] = [];
  let embeddingStatus: 'generated' | 'failed' = 'failed';
  let embeddingError: string | null = null;
  const entries: Array<{ chunk: string; vector: number[] }> = [];
  let vectorStoreIds: string[] = [];

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    embeddingError = 'Empty content';
    console.error('âŒ Empty content for document:', originalName);
  } else {
    console.log('ðŸ”„ Creating embeddings for document:', originalName, 'chunks:', chunks.length, 'total length:', content.length);

    for (const [i, chunk] of chunks.entries()) {
      console.log('ðŸ”¹ Embedding chunk', i + 1, 'of', chunks.length, 'length:', chunk.length);
      try {
        const vector = await createProviderEmbedding(chunk);
        if (vector.length > 0) {
          entries.push({ chunk, vector });
        } else {
          console.warn(`âš ï¸ Empty embedding for chunk ${i + 1}`);
        }
      } catch (err) {
        console.warn(`âŒ Failed to embed chunk ${i + 1}:`, err);
      }
    }

    if (entries.length > 0) {
      const dim = entries[0].vector.length;
      embedding = new Array(dim).fill(0);
      for (const entry of entries) {
        for (let d = 0; d < dim; d++) {
          embedding[d] += entry.vector[d];
        }
      }
      for (let d = 0; d < dim; d++) {
        embedding[d] /= entries.length;
      }
      embeddingStatus = 'generated';
      console.log('âœ… Embeddings created for document:', originalName, 'chunks:', entries.length, 'vector size:', dim);
    } else {
      embeddingError = 'Empty embedding returned';
      console.error('âŒ Empty embedding returned');
    }
  }

  const doc = await DocumentModel.create({
    filename,
    originalName,
    department,
    content,
    embedding: embedding.length > 0 ? embedding : null,
    embeddingStatus,
    embeddingError,
    metadata: {
      size: stats.size,
      mimeType,
      vectorStoreIds: [],
    },
  });

  if (embedding.length > 0) {
    const docId = doc._id.toString();
    vectorStoreIds = entries.map((_, i) => `${docId}@chunk${i}`);

    try {
      await DocumentModel.updateOne(
        { _id: doc._id },
        { $set: { 'metadata.vectorStoreIds': vectorStoreIds } }
      );
      doc.metadata.vectorStoreIds = vectorStoreIds;
    } catch (err) {
      console.warn('âš ï¸ Failed to persist vectorStoreIds:', err);
    }

    try {
      const client = await getChromaClient();
      const collection = await client.getOrCreateCollection({ name: CHROMA_COLLECTION });
      await collection.add({
        ids: vectorStoreIds,
        embeddings: entries.map(e => e.vector),
        documents: entries.map(e => e.chunk),
        metadatas: entries.map((e, i) => ({
          originalName,
          department,
          source: 'document',
          docId,
          chunkIndex: i,
        })),
      });
      console.log('âœ… Document indexed to ChromaDB:', originalName, 'vectors:', vectorStoreIds.length);
      await DocumentModel.updateOne(
        { _id: doc._id },
        { $set: { lastIndexedAt: new Date() } }
      );
    } catch (err) {
      console.error('âŒ Failed to index document to ChromaDB:', err);
    }
  }

  return {
    id: doc._id.toString(),
    filename: doc.filename,
    originalName: doc.originalName,
    department: doc.department,
    content: doc.content,
    metadata: doc.metadata,
    path: `/uploads/knowledge/${filename}`,
    createdAt: doc.createdAt,
  };
}

export async function searchKnowledgeBase(
  query: string,
  department?: Department,
  limit: number = 5
): Promise<SearchResult[]> {
  const queryEmbedding = await createProviderEmbedding(query);
  if (queryEmbedding.length === 0) return [];

  const client = await getChromaClient();
  const collection = await client.getOrCreateCollection({ name: CHROMA_COLLECTION });

  const queryResult = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
    where: department ? { department } : undefined,
    include: ['metadatas', 'documents', 'distances'] as any
  });

  const searchResults: SearchResult[] = [];
  const ids = queryResult.ids?.[0] || [];
  const documents = queryResult.documents?.[0] || [];
  const metadatas = queryResult.metadatas?.[0] || [];
  const distances = queryResult.distances?.[0] || [];

  for (let i = 0; i < ids.length; i++) {
    const metadata = (metadatas[i] as Record<string, any>) || {};
    searchResults.push({
      documentId: ids[i],
      content: documents[i] || '',
      department: metadata.department || 'Cloud',
      score: 1 - (distances[i] ?? 1),
      source: metadata.originalName || '',
    });
  }

  return searchResults;
}

export async function getAllDocuments(department?: Department): Promise<DocType[]> {
  const filter = department ? { department } : {};
  const docs = await DocumentModel.find(filter).lean();
  return docs.map((doc: any) => ({
    id: doc._id.toString(),
    filename: doc.filename,
    originalName: doc.originalName,
    department: doc.department,
    content: doc.content,
    embedding: doc.embedding,
    embeddingStatus: doc.embeddingStatus,
    embeddingError: doc.embeddingError,
    metadata: doc.metadata,
    lastIndexedAt: doc.lastIndexedAt,
    path: `/uploads/knowledge/${doc.filename}`,
    createdAt: doc.createdAt,
  }));
}

export async function deleteDocument(id: string): Promise<void> {
  const doc = await DocumentModel.findById(id);
  await DocumentModel.findByIdAndDelete(id);

  if (!doc) return;

  const staleIds = [
    id,
    ...(Array.isArray(doc.metadata?.vectorStoreIds) ? doc.metadata.vectorStoreIds : []),
  ].filter(Boolean);

  try {
    const client = await getChromaClient();
    const collection = await client.getOrCreateCollection({ name: CHROMA_COLLECTION });
    await collection.delete({ ids: [...new Set(staleIds)] });
    await collection.delete({ where: { docId: id } }).catch(() => undefined);
  } catch (err) {
    console.error('âŒ Failed to delete document vectors from ChromaDB:', err);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

export interface SemanticSearchResult {
  id: string;
  originalName: string;
  department: string;
  content: string;
  snippet: string;
  highlightedSnippet?: string;
  score: number;
  path?: string;
  createdAt: Date;
}

export async function semanticSearchDocuments(
  query: string,
  department?: Department,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  let queryEmbedding: number[] = [];
  
  try {
    queryEmbedding = await createProviderEmbedding(query);
  } catch (err) {
    console.error('âŒ Failed to create query embedding:', err);
    return [];
  }
  
  if (queryEmbedding.length === 0) {
    console.warn('âš ï¸ No query embedding generated');
    return [];
  }

  const filter = department 
    ? { department, embedding: { $exists: true, $ne: null } } 
    : { embedding: { $exists: true, $ne: null } };
  
  const docs = await DocumentModel.find(filter).lean();
  
  if (docs.length === 0) {
    return [];
  }

  const results: SemanticSearchResult[] = docs
    .map((doc: any) => {
      const docEmbedding = doc.embedding || [];
      const score = cosineSimilarity(queryEmbedding, docEmbedding);
      
      const content = doc.content || '';
      const queryLower = query.toLowerCase();
      const contentLower = content.toLowerCase();
      const queryIndex = contentLower.indexOf(queryLower);
      
      let snippet = '';
      let highlightedSnippet = '';
      if (queryIndex >= 0) {
        const start = Math.max(0, queryIndex - 80);
        const end = Math.min(content.length, queryIndex + query.length + 80);
        const before = content.slice(start, queryIndex);
        const match = content.slice(queryIndex, queryIndex + query.length);
        const after = content.slice(queryIndex + query.length, end);
        snippet = (start > 0 ? '...' : '') + before + match + after + (end < content.length ? '...' : '');
        highlightedSnippet = (start > 0 ? '...' : '') + before + '<mark>' + match + '</mark>' + after + (end < content.length ? '...' : '');
      } else {
        snippet = content.slice(0, 150) + (content.length > 150 ? '...' : '');
        highlightedSnippet = snippet;
      }
      
      return {
        id: doc._id.toString(),
        originalName: doc.originalName,
        department: doc.department,
        content: doc.content,
        snippet,
        highlightedSnippet,
        score,
        path: `/uploads/knowledge/${doc.filename}`,
        createdAt: doc.createdAt,
      };
    })
    .filter((r: SemanticSearchResult) => r.score > 0)
    .sort((a: SemanticSearchResult, b: SemanticSearchResult) => b.score - a.score)
    .slice(0, limit);

  return results;
  }

  export async function reindexDocumentsToChroma(): Promise<{ success: number; failed: number }> {
    const docs = await DocumentModel.find({ 
      content: { $exists: true, $ne: '' } 
    }).lean() as any[];
    
    console.log(`ðŸ”„ Re-indexing ${docs.length} documents to ChromaDB...`);
    
    const client = await getChromaClient();
    const collection = await client.getOrCreateCollection({ name: CHROMA_COLLECTION });
    
    let success = 0;
    let failed = 0;
    const batchSize = 10;
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const contents = batch.map(doc => doc.content || '');
      
      try {
        const embeddings = await createProviderEmbeddings(contents);
        
        const validItems = batch.map((doc, idx) => ({
          doc,
          embedding: embeddings[idx] || [],
          content: contents[idx]
        })).filter(item => item.embedding.length > 0);
        
        if (validItems.length === 0) {
          failed += batch.length;
          continue;
        }
        
        const chromaIds = validItems.map(item => item.doc._id.toString());
        const staleIds: string[] = [];
        for (const item of validItems) {
          staleIds.push(item.doc._id.toString());
          if (Array.isArray(item.doc.metadata?.vectorStoreIds)) {
            staleIds.push(...item.doc.metadata.vectorStoreIds);
          }
        }
        await collection.delete({ ids: [...new Set(staleIds.filter(Boolean))] }).catch(() => undefined);

        await collection.add({
          ids: chromaIds,
          embeddings: validItems.map(item => item.embedding),
          documents: validItems.map(item => item.content),
          metadatas: validItems.map(item => ({
            originalName: item.doc.originalName || '',
            department: item.doc.department || '',
            source: 'document',
            docId: item.doc._id.toString(),
          }))
        });
        
        const ids = validItems.map(item => item.doc._id);
        await DocumentModel.updateMany(
          { _id: { $in: ids } },
          { lastIndexedAt: new Date() }
        );
        
        success += validItems.length;
        failed += (batch.length - validItems.length);

        await new Promise(r => setTimeout(r, 50));

      } catch (err) {
        console.error(`âŒ Failed to index batch starting at ${i}:`, err);
        failed += batch.length;
      }
    }
    
    console.log(`âœ… Documents reindex complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }
