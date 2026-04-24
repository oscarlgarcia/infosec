interface Metadata {
  [key: string]: string | number | boolean;
}

export async function initChromaCollection(name: string = 'infosec-kb') {
  console.warn('⚠️ ChromaDB not available - using dummy implementation');
  return null;
}

export async function addToCollection(
  _collectionName: string,
  _ids: string[],
  _embeddings: number[][],
  _documents: string[],
  _metadatas: Metadata[]
) {
  return;
}

export async function queryCollection(
  _collectionName: string,
  _queryEmbeddings: number[],
  _nResults: number = 5,
  _where?: Record<string, string>
) {
  return { documents: [], ids: [], metadatas: [], distances: [] };
}

export async function deleteFromCollection(
  _collectionName: string,
  _ids: string[]
) {
  return;
}
