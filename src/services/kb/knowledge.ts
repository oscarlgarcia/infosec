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
  
  try {
    console.log('🔄 Creating embedding for document:', originalName, 'Content length:', content.length);
    embedding = await createProviderEmbedding(content);
    if (embedding.length > 0) {
      embeddingStatus = 'generated';
      console.log('✅ Embedding created, vector size:', embedding.length);
    } else {
      embeddingError = 'Empty embedding returned';
      console.error('❌ Empty embedding returned');
    }
  } catch (err: unknown) {
    embeddingError = err instanceof Error ? err.message : String(err);
    console.error('❌ Failed to create embedding:', err);
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
    },
  });

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
    include: ['metadatas', 'documents', 'distances']
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
  await DocumentModel.findByIdAndDelete(id);
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
    console.error('❌ Failed to create query embedding:', err);
    return [];
  }
  
  if (queryEmbedding.length === 0) {
    console.warn('⚠️ No query embedding generated');
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
    
    console.log(`🔄 Re-indexing ${docs.length} documents to ChromaDB...`);
    
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
        
        await collection.add({
          ids: validItems.map(item => item.doc._id.toString()),
          embeddings: validItems.map(item => item.embedding),
          documents: validItems.map(item => item.content),
          metadatas: validItems.map(item => ({
            originalName: item.doc.originalName || '',
            department: item.doc.department || '',
            source: 'document'
          }))
        });
        
        const ids = validItems.map(item => item.doc._id);
        await DocumentModel.updateMany(
          { _id: { $in: ids } },
          { lastIndexedAt: new Date() }
        );
        
        success += validItems.length;
        failed += (batch.length - validItems.length);
        
      } catch (err) {
        console.error(`❌ Failed to index batch starting at ${i}:`, err);
        failed += batch.length;
      }
    }
    
    console.log(`✅ Documents reindex complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }
