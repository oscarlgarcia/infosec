import { QAEntry } from '../../db/mongo/models';
import { createOllamaEmbedding } from '../llm/openai';
import { getChromaClient } from '../chroma/indexer';

type Department = 'Cloud' | 'IT' | 'Development' | 'Compliance' | 'Legal';

export interface QA {
  id: string;
  questionNumber?: string;
  question: string;
  answer: string;
  department?: Department;
  infoSecDomain?: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const INFOSEC_DOMAINS = [
  { name: 'InfoSec Policy & Procedures', section: 1 },
  { name: 'Security Human Resource', section: 2 },
  { name: 'Asset management', section: 3 },
  { name: 'Access control', section: 4 },
  { name: 'Encryption', section: 5 },
  { name: 'Physical and Logical security', section: 6 },
  { name: 'ESG', section: 7 },
  { name: 'SDLC', section: 8 },
  { name: 'Relation with suppliers/third-party', section: 9 },
  { name: 'Incident Management', section: 10 },
  { name: 'Business Continuity', section: 11 },
  { name: 'Operational management', section: 12 },
  { name: 'Compliance', section: 13 },
  { name: 'Audit', section: 14 },
  { name: 'Information Security', section: 15 },
  { name: 'IT General Security', section: 16 },
  { name: 'IT Network Security', section: 17 },
  { name: 'IT Systems Security', section: 18 },
  { name: 'Risk Management', section: 19 },
  { name: 'Segregation of Duties', section: 20 },
  { name: 'Intellectual Property & Proprietary Rights', section: 21 },
] as const;

export const INFOSEC_DOMAIN_LIST = INFOSEC_DOMAINS.map(d => d.name);

type InfoSecDomain = typeof INFOSEC_DOMAINS[number]['name'];

function getDomainSection(domainName: string): number {
  const domain = INFOSEC_DOMAINS.find(d => d.name === domainName);
  return domain ? domain.section : 0;
}

function getDomainBySection(section: number): string | undefined {
  const domain = INFOSEC_DOMAINS.find(d => d.section === section);
  return domain?.name;
}

function getSectionFromQuestionNumber(questionNumber: string): number {
  const parts = questionNumber.split('.');
  return parts.length > 0 ? Number(parts[0]) : 0;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

export interface QASearchResult {
  id: string;
  question: string;
  answer: string;
  questionNumber?: string;
  infoSecDomain?: string;
  similarity: number;
  matchType: 'exact' | 'similar' | 'none';
}

export async function generateQAEmbeddings(): Promise<number> {
  const entries = await QAEntry.find({ 
    $or: [
      { embedding: { $exists: false } },
      { embedding: null }
    ]
  }).lean();
  
  let generated = 0;
  console.log(`🔄 Generating embeddings for ${entries.length} QA entries...`);
  
  for (const entry of entries as any[]) {
    try {
      const embedding = await createOllamaEmbedding(entry.question);
      await QAEntry.findByIdAndUpdate(entry._id, {
        embedding: embedding.length > 0 ? embedding : null,
        embeddingStatus: embedding.length > 0 ? 'generated' : 'failed'
      });
      generated++;
      if (generated % 10 === 0) {
        console.log(`✅ Generated ${generated}/${entries.length} embeddings`);
      }
    } catch (err) {
      console.error(`❌ Failed to generate embedding for: ${entry.question.substring(0, 50)}...`);
      await QAEntry.findByIdAndUpdate(entry._id, { embeddingStatus: 'failed' });
    }
  }
  
  console.log(`✅ Total embeddings generated: ${generated}`);
  return generated;
}

export async function semanticSearchQA(query: string, minSimilarity: number = 0): Promise<QASearchResult[]> {
  if (!query.trim()) return [];
  
  try {
    const queryEmbedding = await createOllamaEmbedding(query);
    if (!queryEmbedding.length) {
      console.error('❌ No query embedding generated');
      return [];
    }
    
    const entries = await QAEntry.find({ 
      embedding: { $exists: true, $ne: null },
      embeddingStatus: 'generated'
    }).lean();
    
    if (entries.length === 0) {
      console.warn('⚠️ No QA entries with embeddings found');
      return [];
    }
    
    const results: QASearchResult[] = entries
      .map((e: any) => {
        const similarity = cosineSimilarity(queryEmbedding, e.embedding || []);
        const matchType = similarity >= 0.95 ? 'exact' : similarity >= 0.75 ? 'similar' : 'none';
        return {
          id: e._id.toString(),
          question: e.question,
          answer: e.answer,
          questionNumber: e.questionNumber,
          infoSecDomain: e.infoSecDomain,
          similarity,
          matchType
        };
      })
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity);
    
    return results;
  } catch (err) {
    console.error('❌ Semantic search failed:', err);
    return [];
  }
}

export async function generateQuestionNumber(infoSecDomain: string): Promise<string> {
  const section = getDomainSection(infoSecDomain);
  if (section === 0) return '';
  
  const entries = await QAEntry.find({ questionNumber: { $regex: `^${section}\\.` } }).lean();
  
  let maxSubNumber = 0;
  for (const e of entries) {
    if (e.questionNumber) {
      const parts = e.questionNumber.split('.');
      if (parts.length === 2 && Number(parts[0]) === section) {
        const subNum = Number(parts[1]);
        if (subNum > maxSubNumber) {
          maxSubNumber = subNum;
        }
      }
    }
  }
  
  return `${section}.${maxSubNumber + 1}`;
}

export interface ParsedQA {
  questionNumber: string;
  question: string;
  answer: string;
  infoSecDomain?: string;
}

function parseQAText(content: string): ParsedQA[] {
  const results: ParsedQA[] = [];
  
  const lines = content.split('\n').filter(l => l.trim());
  let currentDomain = '';
  let i = 0;
  
  for (const domain of INFOSEC_DOMAINS) {
    const domainIndex = lines.findIndex(l => l.startsWith(domain) || l.includes(domain));
    if (domainIndex !== -1) {
      const sectionTitle = lines[domainIndex + 1]?.match(/^(\d+\.\d+)\s+(.+)/);
      if (sectionTitle) {
        currentDomain = domain;
        break;
      }
    }
  }
  
  i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const numberMatch = line.match(/^(\d+\.\d+)\s+(.+)/);
    
    let detectedDomain = '';
    for (const domain of INFOSEC_DOMAINS) {
      if (line.includes(domain)) {
        detectedDomain = domain;
        break;
      }
    }
    if (detectedDomain) {
      currentDomain = detectedDomain;
      i++;
      continue;
    }
    
    if (numberMatch) {
      const questionNumber = numberMatch[1];
      let question = numberMatch[2].trim();
      let answer = '';
      
      i++;
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        const nextNumberMatch = nextLine.match(/^(\d+\.\d+)\s+/);
        
        let nextSectionDomain = '';
        for (const domain of INFOSEC_DOMAINS) {
          if (nextLine.includes(domain)) {
            nextSectionDomain = domain;
            break;
          }
        }
        if (nextSectionDomain) {
          currentDomain = nextSectionDomain;
          break;
        }
        
        if (nextNumberMatch) break;
        
        if (!question) {
          question = nextLine;
        } else {
          answer += ' ' + nextLine;
        }
        i++;
      }
      
      if (question) {
        results.push({
          questionNumber,
          question: question.replace(/\?$/, '').trim(),
          answer: answer.trim() || 'N/A',
          infoSecDomain: currentDomain
        });
      }
      continue;
    }
    i++;
  }
  
  return results;
}

function resolveInfoSecDomain(questionNumber?: string, existingDomain?: string): string | undefined {
  if (existingDomain) return existingDomain;
  if (!questionNumber) return undefined;
  const section = getSectionFromQuestionNumber(questionNumber);
  return getDomainBySection(section);
}

export async function getAllQA(): Promise<QA[]> {
  const entries = await QAEntry.find({}).lean();
  return entries.map((e: any) => ({
    id: e._id.toString(),
    questionNumber: e.questionNumber,
    question: e.question,
    answer: e.answer,
    department: e.department,
    infoSecDomain: resolveInfoSecDomain(e.questionNumber, e.infoSecDomain),
    source: e.source,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
}

export async function createQA(data: { questionNumber?: string; question: string; answer: string; department?: Department; infoSecDomain?: string; source?: string }): Promise<QA> {
  let questionNumber = data.questionNumber;
  
  if (!questionNumber && data.infoSecDomain) {
    questionNumber = await generateQuestionNumber(data.infoSecDomain);
  }
  
  const entry = await QAEntry.create({
    ...data,
    questionNumber: questionNumber || undefined,
  });
  return {
    id: entry._id.toString(),
    questionNumber: entry.questionNumber,
    question: entry.question,
    answer: entry.answer,
    department: entry.department as Department | undefined,
    infoSecDomain: resolveInfoSecDomain(entry.questionNumber, entry.infoSecDomain),
    source: entry.source,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function updateQA(id: string, data: { questionNumber?: string; question: string; answer: string; department?: Department; infoSecDomain?: string }): Promise<QA | null> {
  const entry = await QAEntry.findByIdAndUpdate(id, data, { new: true });
  if (!entry) return null;
  return {
    id: entry._id.toString(),
    questionNumber: entry.questionNumber,
    question: entry.question,
    answer: entry.answer,
    department: entry.department as Department | undefined,
    infoSecDomain: resolveInfoSecDomain(entry.questionNumber, entry.infoSecDomain),
    source: entry.source,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function deleteQA(id: string): Promise<void> {
  await QAEntry.findByIdAndDelete(id);
}

export async function importQAText(content: string, source: string = 'import'): Promise<{ imported: number; skipped: number }> {
  console.log('🗑️ Deleting existing QA entries...');
  await QAEntry.deleteMany({});
  
  const parsed = parseQAText(content);
  
  let imported = 0;
  let skipped = 0;
  
  console.log(`🔄 Importing ${parsed.length} Q&A entries with embeddings...`);
  
  const chromaEntries: Array<{ id: string; text: string; question: string; answer: string; domain: string }> = [];
  
  for (const qa of parsed) {
    let embeddingStatus: 'generated' | 'failed' | 'pending' = 'pending';
    let embedding: number[] | null = null;
    
    try {
      embedding = await createOllamaEmbedding(qa.question);
      embeddingStatus = embedding.length > 0 ? 'generated' : 'failed';
    } catch (err) {
      console.error(`❌ Failed to create embedding for: ${qa.question.substring(0, 30)}...`);
      embeddingStatus = 'failed';
    }
    
    const entry = await QAEntry.create({
      questionNumber: qa.questionNumber || undefined,
      question: qa.question,
      answer: qa.answer,
      infoSecDomain: resolveInfoSecDomain(qa.questionNumber, qa.infoSecDomain),
      source,
      embedding,
      embeddingStatus,
    });
    imported++;
    
    if (embedding && embedding.length > 0) {
      chromaEntries.push({
        id: entry._id.toString(),
        text: `${qa.question} ${qa.answer}`.trim(),
        question: qa.question,
        answer: qa.answer,
        domain: resolveInfoSecDomain(qa.questionNumber, qa.infoSecDomain) || 'general',
      });
    }
    
    if (imported % 20 === 0) {
      console.log(`✅ Imported ${imported}/${parsed.length} entries`);
    }
  }
  
  if (chromaEntries.length > 0) {
    console.log(`🔄 Indexing ${chromaEntries.length} entries in ChromaDB...`);
    try {
      const client = await getChromaClient();
      const collection = await client.getOrCreateCollection({ name: 'qanda' });
      
      for (const entry of chromaEntries) {
        try {
          const emb = await createOllamaEmbedding(entry.text);
          if (emb.length > 0) {
            await collection.add({
              ids: [entry.id],
              embeddings: [emb],
              documents: [entry.text],
              metadatas: [{
                question: entry.question,
                answer: entry.answer,
                department: '',
                category: entry.domain,
                source: 'qa'
              }]
            });
          }
        } catch (err) {
          console.error(`❌ Failed to index in Chroma: ${entry.question.substring(0, 30)}...`);
        }
      }
      console.log(`✅ Indexed ${chromaEntries.length} entries in ChromaDB`);
    } catch (err) {
      console.error('❌ Failed to index entries in ChromaDB:', err);
    }
  }
  
  console.log(`✅ Import complete: ${imported} entries imported`);
  return { imported, skipped };
}

export async function exportQAText(): Promise<string> {
  const entries = await QAEntry.find({}).lean();
  
  let content = '';
  for (const e of entries as any[]) {
    if (e.questionNumber) {
      content += `${e.questionNumber} ${e.question}\n${e.answer}\n\n`;
    } else {
      content += `${e.question}\n${e.answer}\n\n`;
    }
  }
  
  return content;
}

export async function getQAById(id: string): Promise<QA | null> {
  const entry = await QAEntry.findById(id).lean();
  if (!entry) return null;
  return {
    id: entry._id.toString(),
    questionNumber: entry.questionNumber,
    question: entry.question,
    answer: entry.answer,
    department: entry.department as Department | undefined,
    source: entry.source,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function reindexQAEntriesToChroma(): Promise<{ success: number; failed: number }> {
  const entries = await QAEntry.find({}).lean() as any[];
  console.log(`🔄 Re-indexing ${entries.length} QA entries to ChromaDB...`);
  
  const client = await getChromaClient();
  
  try {
    await client.deleteCollection({ name: 'qanda' });
    console.log('🗑️ Cleared qanda collection');
  } catch (e) {
    console.log('ℹ️ qanda collection did not exist');
  }
  
  const collection = await client.getOrCreateCollection({ name: 'qanda' });
  
  let success = 0;
  let failed = 0;
  
  for (const entry of entries) {
    try {
      const text = `${entry.question || ''} ${entry.answer || ''}`.trim();
      if (text.length < 5) {
        failed++;
        continue;
      }
      
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
          category: entry.infoSecDomain || '',
          source: 'qa'
        }]
      });
      
      success++;
      if (success % 20 === 0) {
        console.log(`✅ Indexed ${success}/${entries.length}`);
      }
    } catch (err) {
      console.error(`❌ Failed to index ${entry._id}:`, err);
      failed++;
    }
  }
  
  console.log(`✅ Re-index complete: ${success} success, ${failed} failed`);
  return { success, failed };
}