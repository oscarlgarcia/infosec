import { ChromaClient } from 'chromadb';
import { createOllamaEmbedding } from './llm/openai';

const CHROMA_HOST = process.env.CHROMA_HOST || 'chroma';
const CHROMA_PORT = process.env.CHROMA_PORT || '8000';

let chromaClient: ChromaClient | null = null;

async function getChromaClient(): Promise<ChromaClient> {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: `http://${CHROMA_HOST}:${CHROMA_PORT}`,
    });
  }
  return chromaClient;
}

interface GapAnalysis {
  query: string;
  coverage: number;
  gapsFound: GapItem[];
  strengths: GapItem[];
  metrics: CoverageMetrics;
}

interface GapItem {
  id: string;
  title: string;
  source: 'qanda' | 'document' | 'cms' | 'faq';
  similarity: number;
  severity: 'high' | 'medium' | 'low';
  category?: string;
  department?: string;
  action?: string;
  actionType?: 'add-content' | 'add-qa';
}

interface CoverageMetrics {
  questionsAnalyzed: number;
  topicsCovered: number;
  gapsDetected: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  avgDepthScore: number;
  topCategories: Record<string, number>;
}

function determineSeverity(similarity: number): GapItem['severity'] {
  if (similarity >= 0.8) return 'low';
  if (similarity >= 0.5) return 'medium';
  return 'high';
}

function generateAction(item: GapItem): { action: string; actionType: 'add-content' | 'add-qa' } {
  const types: Array<{ action: string; actionType: 'add-content' | 'add-qa' }> = [
    { action: 'Añadir contenido detallado sobre este tema', actionType: 'add-content' },
    { action: 'Crear Q&A sobre: ' + item.title, actionType: 'add-qa' },
  ];
  
  if (item.similarity < 0.3) {
    return { action: 'Añadir contenido completo sobre "' + item.title + '"', actionType: 'add-content' };
  }
  if (item.severity === 'high') {
    return { action: 'Crear Q&A y documentación sobre "' + item.title + '"', actionType: 'add-qa' };
  }
  return types[Math.floor(Math.random() * types.length)];
}

export async function analyzeGap(query: string, topK: number = 10000): Promise<GapAnalysis> {
  const client = await getChromaClient();
  
  const queryEmbedding = await createOllamaEmbedding(query);
  if (queryEmbedding.length === 0) {
    throw new Error('Failed to generate query embedding');
  }
  
  const collections = ['qanda', 'cms', 'knowledge', 'faq'];
  const gaps: GapItem[] = [];
  const strengths: GapItem[] = [];
  const categoryCount: Record<string, number> = {};
  
  let questionsAnalyzed = 0;
  let topicsCovered = 0;
  
  for (const collectionName of collections) {
    try {
      const collection = await client.getOrCreateCollection({ name: collectionName });
      
      // Skip empty collections (newly created or no data)
      const count = await collection.count();
      console.log(`[GapFinder] Collection ${collectionName}: ${count} documents`);
      
      if (count === 0) {
        console.log(`[GapFinder] Collection ${collectionName} is empty, skipping...`);
        continue;
      }
      
      console.log(`[GapFinder] Querying collection ${collectionName}...`);
      
      let results;
      try {
        results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topK,
          include: ['metadatas', 'documents', 'distances']
        });
        
      console.log(`[GapFinder] Query results from ${collectionName}: ids=${results.ids?.[0]?.length || 0}, docs=${results.documents?.[0]?.length || 0}, dist=${results.distances?.[0]?.length || 0}`);
      if (results.distances?.[0]?.length > 0) {
        console.log(`[GapFinder] Sample distances:`, results.distances[0].slice(0, 5));
      }
      } catch (queryError) {
        console.error(`[GapFinder] Query failed for ${collectionName}:`, queryError);
        continue;
      }
      
      const ids = results.ids[0] || [];
      const documents = results.documents[0] || [];
      const metadatas = results.metadatas[0] || [];
      const distances = results.distances[0] || [];
      
      questionsAnalyzed += ids.length;  // Count ALL documents returned by ChromaDB
       
       for (let i = 0; i < ids.length; i++) {
         const id = ids[i];
         const doc = documents[i] || '';
         const metadata = metadatas[i] || {};
          const distance = distances[i] ?? 2;
          
          // ChromaDB with cosine space returns cosine SIMILARITY (0-1), not distance!
          // The values are already similarities, NOT distances
          const similarity = distance; // Use directly, don't convert
          
          // UNDERSTANDING: If it was cosine DISTANCE (0-2), we'd use: 1 - distance/2
          // But ChromaDB cosine space returns similarities where:
          //   1.0 = identical, 0.8 = very similar, 0.5 = somewhat related, 0.1 = not related
          
          // Debug: log first 5 similarities
          if (i < 5) {
            console.log(`[GapFinder] ${collectionName} - id:${id}, raw_value:${distance}, used_as_similarity:${similarity}`);
          }
          
          // Skip items with very low similarity (not relevant to query)
          if (similarity < 0.1) continue;
         
         const category = metadata.category || metadata.source || 'General';
         categoryCount[category] = (categoryCount[category] || 0) + 1;
         
         if (similarity >= 0.5) {
           topicsCovered++;
         }
         
         const title = metadata.title || metadata.question || doc.substring(0, 30) || id;
         
         const actionInfo = generateAction({ id, title, similarity, severity: determineSeverity(similarity) });
         
         const item: GapItem = {
           id,
           title,
           source: (metadata.source || collectionName) as GapItem['source'],
           similarity: Math.round(similarity * 100) / 100,
           severity: determineSeverity(similarity),
           category,
           department: metadata.department,
           ...actionInfo
         };
         
         if (similarity >= 0.5) {
           strengths.push(item);
         } else if (similarity >= 0.1) {
           gaps.push(item);
         }
       }
    } catch (error) {
      console.warn(`Collection ${collectionName} not found or error:`, error);
    }
  }
  
  const gapsSorted = [...gaps]
    .filter(g => g.severity === 'high')
    .concat([...gaps].filter(g => g.severity !== 'high'))
    .slice(0, 15);
  
  const relevantDocs = strengths.length + gaps.length;
  const coverage = relevantDocs > 0 
    ? Math.round((strengths.length / relevantDocs) * 100) 
    : 0;
  
  const metrics: CoverageMetrics = {
    questionsAnalyzed: questionsAnalyzed,  // Total documents returned by ChromaDB (168)
    topicsCovered: strengths.length,
    gapsDetected: gaps.length,
    highSeverity: gaps.filter(g => g.severity === 'high').length,
    mediumSeverity: gaps.filter(g => g.severity === 'medium').length,
    lowSeverity: gaps.filter(g => g.severity === 'low').length,
    avgDepthScore: 0,
    topCategories: Object.fromEntries(
      Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    )
  };
  
  return {
    query,
    coverage,
    gapsFound: gapsSorted,
    strengths: strengths.slice(0, 10),
    metrics
  };
}