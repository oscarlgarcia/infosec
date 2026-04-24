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
  source: 'qanda' | 'document';
  similarity: number;
  severity: 'high' | 'medium' | 'low';
  category?: string;
  department?: string;
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

export async function analyzeGap(query: string, topK: number = 50): Promise<GapAnalysis> {
  const mockGapItems = [
    { id: '1', title: 'SDLC Overview', source: 'document' as const, similarity: 0.45, severity: 'high' as const, category: 'Development' },
    { id: '2', title: 'Code Review Process', source: 'document' as const, similarity: 0.38, severity: 'high' as const, category: 'Development' },
    { id: '3', title: 'Testing Guidelines', source: 'qanda' as const, similarity: 0.52, severity: 'medium' as const, category: 'QA' },
    { id: '4', title: 'Deployment Pipeline', source: 'document' as const, similarity: 0.28, severity: 'high' as const, category: 'DevOps' },
    { id: '5', title: 'Security Testing', source: 'document' as const, similarity: 0.65, severity: 'medium' as const, category: 'Security' },
  ];

  const mockStrengths = [
    { id: 's1', title: 'Security Best Practices', source: 'document' as const, similarity: 0.78, severity: 'low' as const, category: 'Security' },
    { id: 's2', title: 'Access Control Policy', source: 'document' as const, similarity: 0.72, severity: 'low' as const, category: 'Access' },
  ];

  const mockMetrics = {
    questionsAnalyzed: 156,
    topicsCovered: 89,
    gapsDetected: 5,
    highSeverity: 3,
    mediumSeverity: 2,
    lowSeverity: 0,
    avgDepthScore: 2.8,
    topCategories: { Development: 2, Security: 2, DevOps: 1 },
  };

  return {
    query,
    coverage: 57,
    gapsFound: mockGapItems,
    strengths: mockStrengths,
    metrics: mockMetrics,
  };
}