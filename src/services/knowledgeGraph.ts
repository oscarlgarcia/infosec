interface GraphNode {
  id: string;
  label: string;
  type: 'cms' | 'faq' | 'qanda' | 'document';
  title: string;
  category?: string;
  department?: string;
}

interface GraphLink {
  source: string;
  target: string;
  similarity: number;
}

interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphStats {
  totalNodes: number;
  cmsNodes: number;
  faqNodes: number;
  qandaNodes: number;
  documentNodes: number;
  totalLinks: number;
}

export async function generateKnowledgeGraph(): Promise<KnowledgeGraphData> {
  const mockNodes: GraphNode[] = [
    { id: '1', label: 'Security Policy', type: 'cms', title: 'Security Policy', category: 'Security' },
    { id: '2', label: 'Access Control', type: 'cms', title: 'Access Control', category: 'Security' },
    { id: '3', label: 'Password Policy', type: 'faq', title: 'Password Policy', category: 'Security' },
    { id: '4', label: 'Data Privacy', type: 'cms', title: 'Data Privacy', category: 'Privacy' },
    { id: '5', label: 'Incident Response', type: 'document', title: 'Incident Response', category: 'Operations' },
    { id: '6', label: 'SDLC Overview', type: 'document', title: 'SDLC Overview', category: 'Development' },
    { id: '7', label: 'Code Review', type: 'qanda', title: 'Code Review', category: 'Development' },
    { id: '8', label: 'Testing QA', type: 'qanda', title: 'Testing QA', category: 'QA' },
  ];

  const mockLinks: GraphLink[] = [
    { source: '1', target: '2', similarity: 0.85 },
    { source: '1', target: '3', similarity: 0.72 },
    { source: '1', target: '4', similarity: 0.68 },
    { source: '2', target: '3', similarity: 0.55 },
    { source: '5', target: '6', similarity: 0.45 },
    { source: '6', target: '7', similarity: 0.62 },
    { source: '7', target: '8', similarity: 0.38 },
  ];

  return {
    nodes: mockNodes,
    links: mockLinks,
  };
}

export async function getGraphStats(): Promise<GraphStats> {
  return {
    totalNodes: 8,
    cmsNodes: 2,
    faqNodes: 1,
    qandaNodes: 2,
    documentNodes: 3,
    totalLinks: 7
  };
}