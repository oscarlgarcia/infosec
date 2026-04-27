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
      
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        include: ['metadatas', 'documents', 'distances']
      });
      
      console.log(`[GapFinder] Query results from ${collectionName}:`, {
        idsCount: results.ids?.[0]?.length || 0,
        docsCount: results.documents?.[0]?.length || 0,
        distancesCount: results.distances?.[0]?.length || 0,
        sampleDistances: results.distances?.[0]?.slice(0, 5) || []
      });
      
      const ids = results.ids[0] || [];
      const documents = results.documents[0] || [];
      const metadatas = results.metadatas[0] || [];
      const distances = results.distances[0] || [];
      
      questionsAnalyzed += ids.length;  // Count ALL documents returned by ChromaDB
      
      // Debug: Count distribution of similarities
      let debugCounts = { high: 0, medium: 0, low: 0, skipped: 0 };
      
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const doc = documents[i] || '';
        const metadata = metadatas[i] || {};
        const distance = distances[i] ?? 2;
        
        // ChromaDB with cosine space returns cosine DISTANCE (1 - similarity), NOT similarity!
        // Values might be returned as scaled percentages (335.6128 or 33.561)
        let distanceValue = distance;
        
        // First: convert scaled values to normalized distance (0-1)
        if (distanceValue > 1) {
          // Could be percentage (33.561) OR percentage×10 (335.6128)
          if (distanceValue > 100) {
            distanceValue = distanceValue / 1000;  // 335.6128 → 0.33561 (distance)
          } else {
            distanceValue = distanceValue / 100;   // 33.561 → 0.33561 (distance)
          }
        }
        
        // Second: convert distance to similarity: similarity = 1 - distance
        let similarity = 1 - distanceValue;
        
        // Ensure valid range 0-1
        if (similarity < 0) similarity = 0;
        if (similarity > 1) similarity = 1;
        // Debug: log first 10 similarities
        if (i < 10) {
          console.log(`[GapFinder] ${collectionName} - id:${id}, similarity:${similarity} (raw:${distance}), title:${metadata.title || metadata.question || doc.substring(0, 20)}`);
        }
        
        // Count distribution
        if (similarity < 0.1) debugCounts.skipped++;
        else if (similarity < 0.5) debugCounts.high++;
        else if (similarity < 0.8) debugCounts.medium++;
        else debugCounts.low++;
        
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
      
      console.log(`[GapFinder] ${collectionName} summary: total=${ids.length}, gaps=${gaps.length}, strengths=${strengths.length}, dist=${JSON.stringify(debugCounts)}`);
      
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
  
  console.log(`[GapFinder] FINAL RESULT: query="${query}", coverage=${coverage}%, gaps=${gapsSorted.length}, strengths=${strengths.slice(0, 10).length}, metrics=`, JSON.stringify(metrics));

  return {
    query,
    coverage,
    gapsFound: gapsSorted,
    strengths: strengths.slice(0, 10),
    metrics
  };
}
