import { getChromaClient } from '../chroma/indexer';
import { createOllamaEmbedding } from '../llm/openai';

interface RetrievedPassage {
  content: string;
  title: string;
  sourceType: 'document' | 'qa' | 'cms' | 'faq';
  itemId: string;
  score: number; // 0-1 similarity score (higher = more similar)
}

export async function retrieveRelevantPassages(args: {
  query: string;
  limit?: number;
}): Promise<RetrievedPassage[]> {
  const { query, limit = 12 } = args;
  
  // Generate embedding for the query
  const queryEmbedding = await createOllamaEmbedding(query);
  if (queryEmbedding.length === 0) {
    console.warn('⚠️ No query embedding generated');
    return [];
  }

  const results: RetrievedPassage[] = [];
  const collections = [
    { name: 'knowledge', sourceType: 'document' as const },
    { name: 'qanda', sourceType: 'qa' as const },
    { name: 'cms', sourceType: 'cms' as const },
    { name: 'faq', sourceType: 'faq' as const },
  ];

  const perCollectionLimit = Math.ceil(limit / 2); // At least 3 from each

  for (const { name, sourceType } of collections) {
    try {
      const client = await getChromaClient();
      const collection = await client.getOrCreateCollection({ name });
      
      // Check if collection has documents
      const count = await collection.count();
      if (count === 0) continue;

      const queryResult = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: perCollectionLimit,
        include: ['metadatas', 'documents', 'distances']
      });

      const ids = queryResult.ids?.[0] || [];
      const documents = queryResult.documents?.[0] || [];
      const metadatas = queryResult.metadatas?.[0] || [];
      const distances = queryResult.distances?.[0] || [];

      for (let i = 0; i < ids.length; i++) {
        const distance = distances[i] ?? 2;
        
        // Convert ChromaDB distance to similarity
        // ChromaDB with cosine space returns: distance = 1 - similarity
        let distanceValue = distance;
        
        // Handle scaled values (335.6128 → 0.33561, or 33.561 → 0.33561)
        if (distanceValue > 1) {
          if (distanceValue > 100) {
            distanceValue = distanceValue / 1000;
          } else {
            distanceValue = distanceValue / 100;
          }
        }
        
        // Convert distance to similarity: similarity = 1 - distance
        let similarity = 1 - distanceValue;
        if (similarity < 0) similarity = 0;
        if (similarity > 1) similarity = 1;

        const metadata = (metadatas[i] as Record<string, any>) || {};
        const content = documents[i] || '';
        const title = metadata.title || metadata.question || metadata.originalName || `${sourceType} item`;
        
        results.push({
          content: content.slice(0, 500), // Limit content length
          title,
          sourceType,
          itemId: ids[i],
          score: similarity,
        });
      }
    } catch (error) {
      console.warn(`⚠️ Error querying collection ${name}:`, error);
      // Continue with other collections
    }
  }

  // Sort by score (highest first) and limit total results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
