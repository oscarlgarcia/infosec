import { ContentPage, FAQ, QAEntry, DocumentModel, CanonicalAnswer } from '../db/mongo/models';
import { retrieveRelevantPassages } from './rag/retriever';

interface GraphNode {
  id: string;
  label: string;
  type: 'term' | 'cms' | 'faq' | 'qa' | 'document' | 'canonical';
  title: string;
  category?: string;
  department?: string;
  score?: number;
  sourceCount?: number;
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

async function fetchSampleNodes(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const pages = await ContentPage.find({ status: 'published' }).limit(30).select('title categoryId slug').lean();
  for (const p of pages) {
    nodes.push({
      id: `cms-${p._id}`,
      label: p.title,
      type: 'cms',
      title: p.title,
      category: 'CMS',
    });
  }

  const faqs = await FAQ.find({ isPublished: true }).limit(20).select('question categoryId').lean();
  for (const f of faqs) {
    nodes.push({
      id: `faq-${f._id}`,
      label: (f as any).question,
      type: 'faq',
      title: (f as any).question,
      category: 'FAQ',
    });
  }

  const qas = await QAEntry.find().limit(30).select('question questionNumber infoSecDomain').lean();
  for (const q of qas) {
    nodes.push({
      id: `qa-${q._id}`,
      label: `${q.questionNumber || ''} ${q.question}`.trim(),
      type: 'qa',
      title: q.question,
      category: q.infoSecDomain || 'QA',
    });
  }

  const docs = await DocumentModel.find().limit(30).select('originalName department').lean();
  for (const d of docs) {
    nodes.push({
      id: `doc-${d._id}`,
      label: (d as any).originalName || (d as any).filename || 'Document',
      type: 'document',
      title: (d as any).originalName || 'Document',
      department: (d as any).department,
    });
  }

  const canonicals = await CanonicalAnswer.find({ status: 'approved' }).limit(15).select('question domain').lean();
  for (const c of canonicals) {
    nodes.push({
      id: `canonical-${c._id}`,
      label: (c as any).question,
      type: 'canonical',
      title: (c as any).question,
      category: (c as any).domain,
    });
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.random() < 0.05) {
        links.push({
          source: nodes[i].id,
          target: nodes[j].id,
          similarity: Math.round((0.3 + Math.random() * 0.6) * 100) / 100,
        });
      }
    }
  }

  return { nodes, links };
}

export async function generateKnowledgeGraph(): Promise<KnowledgeGraphData> {
  return fetchSampleNodes();
}

export async function generateTermGraph(term: string): Promise<KnowledgeGraphData> {
  const passages = await retrieveRelevantPassages({ query: term, limit: 25 });
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  nodes.push({
    id: `term-${term}`,
    label: term,
    type: 'term',
    title: term,
    score: 1,
    sourceCount: passages.length,
  });

  const addedIds = new Set<string>();

  for (const p of passages) {
    const nodeId = `${p.sourceType}-${p.itemId}`;
    if (addedIds.has(nodeId)) continue;
    addedIds.add(nodeId);

    nodes.push({
      id: nodeId,
      label: p.title || p.content.slice(0, 60),
      type: p.sourceType as any,
      title: p.title || p.content.slice(0, 60),
      score: Math.round(p.score * 100),
      sourceCount: 1,
    });

    links.push({
      source: `term-${term}`,
      target: nodeId,
      similarity: Math.round(p.score * 100) / 100,
    });
  }

  const canonicals = await CanonicalAnswer.find({
    status: 'approved',
    question: { $regex: term, $options: 'i' },
  }).limit(10).lean();

  for (const c of canonicals) {
    const nodeId = `canonical-${c._id}`;
    if (addedIds.has(nodeId)) continue;
    addedIds.add(nodeId);

    nodes.push({
      id: nodeId,
      label: (c as any).question,
      type: 'canonical',
      title: (c as any).question,
      category: (c as any).domain,
    });

    links.push({
      source: `term-${term}`,
      target: nodeId,
      similarity: 0.9,
    });
  }

  return { nodes, links };
}

export async function getGraphStats(): Promise<GraphStats> {
  const [cmsCount, faqCount, qaCount, docCount] = await Promise.all([
    ContentPage.countDocuments({ status: 'published' }),
    FAQ.countDocuments({ isPublished: true }),
    QAEntry.countDocuments(),
    DocumentModel.countDocuments(),
  ]);
  const totalNodes = cmsCount + faqCount + qaCount + docCount;
  return {
    totalNodes,
    cmsNodes: cmsCount,
    faqNodes: faqCount,
    qandaNodes: qaCount,
    documentNodes: docCount,
    totalLinks: Math.round(totalNodes * 1.5),
  };
}
