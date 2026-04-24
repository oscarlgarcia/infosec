import { ChromaClient } from 'chromadb';
import { createOllamaEmbedding } from '../llm/openai';

const CHROMA_HOST = process.env.CHROMA_HOST || 'chroma';
const CHROMA_PORT = process.env.CHROMA_PORT || '8000';

let chromaClient: ChromaClient | null = null;

export async function getChromaClient(): Promise<ChromaClient> {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: `http://${CHROMA_HOST}:${CHROMA_PORT}`,
    });
  }
  return chromaClient;
}

export interface MongoDoc {
  _id: string;
  question?: string;
  answer?: string;
  title?: string;
  content?: string;
  summary?: string;
  department?: string;
  category?: string;
  source?: string;
}

export async function indexQAEntries(entries: MongoDoc[]): Promise<{ success: number; failed: number }> {
  const client = await getChromaClient();
  const collection = await client.getOrCreateCollection({ name: 'qanda' });
  
  let success = 0;
  let failed = 0;
  
  for (const entry of entries) {
    try {
      const text = `${entry.question || ''} ${entry.answer || ''}`.trim();
      if (text.length < 5) continue;
      
      const embedding = await createOllamaEmbedding(text);
      if (embedding.length === 0) {
        failed++;
        continue;
      }
      
      await collection.add({
        ids: [entry._id.toString()],
        embeddings: [embedding],
        documents: [text],
        metadatas: [{
          question: entry.question || '',
          answer: entry.answer || '',
          department: entry.department || '',
          category: entry.category || '',
          source: 'qa'
        }]
      });
      success++;
    } catch (error) {
      console.error(`Error indexing QA ${entry._id}:`, error);
      failed++;
    }
  }
  
  return { success, failed };
}

export async function indexContentPages(pages: MongoDoc[]): Promise<{ success: number; failed: number }> {
  const client = await getChromaClient();
  const collection = await client.getOrCreateCollection({ name: 'cms' });
  
  let success = 0;
  let failed = 0;
  
  for (const page of pages) {
    try {
      const text = `${page.title || ''} ${page.summary || ''} ${page.content || ''}`.trim();
      if (text.length < 5) continue;
      
      const embedding = await createOllamaEmbedding(text);
      if (embedding.length === 0) {
        failed++;
        continue;
      }
      
      await collection.add({
        ids: [page._id.toString()],
        embeddings: [embedding],
        documents: [text],
        metadatas: [{
          title: page.title || '',
          content: page.summary || page.content || '',
          department: page.department || '',
          category: page.category || '',
          source: 'cms'
        }]
      });
      success++;
    } catch (error) {
      console.error(`Error indexing CMS ${page._id}:`, error);
      failed++;
    }
  }
  
  return { success, failed };
}

export async function indexDocuments(docs: MongoDoc[]): Promise<{ success: number; failed: number }> {
  const client = await getChromaClient();
  const collection = await client.getOrCreateCollection({ name: 'knowledge' });
  
  let success = 0;
  let failed = 0;
  
  for (const doc of docs) {
    try {
      const text = `${doc.title || ''} ${doc.content || ''}`.trim();
      if (text.length < 5) continue;
      
      const embedding = await createOllamaEmbedding(text);
      if (embedding.length === 0) {
        failed++;
        continue;
      }
      
      await collection.add({
        ids: [doc._id.toString()],
        embeddings: [embedding],
        documents: [text],
        metadatas: [{
          title: doc.title || '',
          content: doc.content || '',
          department: doc.department || '',
          category: doc.category || '',
          source: 'document'
        }]
      });
      success++;
    } catch (error) {
      console.error(`Error indexing document ${doc._id}:`, error);
      failed++;
    }
  }
  
  return { success, failed };
}

export async function indexFAQs(faqs: MongoDoc[]): Promise<{ success: number; failed: number }> {
  const client = await getChromaClient();
  const collection = await client.getOrCreateCollection({ name: 'faq' });
  
  let success = 0;
  let failed = 0;
  
  for (const faq of faqs) {
    try {
      const text = `${faq.question || ''} ${faq.answer || ''}`.trim();
      if (text.length < 5) continue;
      
      const embedding = await createOllamaEmbedding(text);
      if (embedding.length === 0) {
        failed++;
        continue;
      }
      
      await collection.add({
        ids: [faq._id.toString()],
        embeddings: [embedding],
        documents: [text],
        metadatas: [{
          question: faq.question || '',
          answer: faq.answer || '',
          category: faq.category || '',
          source: 'faq'
        }]
      });
      success++;
    } catch (error) {
      console.error(`Error indexing FAQ ${faq._id}:`, error);
      failed++;
    }
  }
  
  return { success, failed };
}

export async function clearAllCollections(): Promise<void> {
  const client = await getChromaClient();
  const collections = ['qanda', 'cms', 'knowledge', 'faq'];
  
  for (const name of collections) {
    try {
      await client.deleteCollection({ name });
    } catch (error) {
      console.warn(`Collection ${name} not found or already deleted`);
    }
  }
}

export async function getCollectionStats(): Promise<Record<string, number>> {
  const client = await getChromaClient();
  const collections = ['qanda', 'cms', 'knowledge', 'faq'];
  const stats: Record<string, number> = {};
  
  for (const name of collections) {
    try {
      const collection = await client.getCollection({ name });
      const result = await collection.get();
      stats[name] = result.ids.length;
    } catch {
      stats[name] = 0;
    }
  }
  
  return stats;
}