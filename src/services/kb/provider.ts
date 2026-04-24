import type {
  KnowledgeItem,
  KnowledgeProvider,
  KnowledgeSearchResponse,
  KnowledgeSourceType,
  KnowledgeSummaryResponse,
} from '../../types';

export type KnowledgeProviderSearchArgs = {
  query: string;
  sourceTypes?: KnowledgeSourceType[];
  limit?: number;
};

export interface KnowledgeProviderRuntime extends KnowledgeProvider {
  search(args: KnowledgeProviderSearchArgs): Promise<KnowledgeSearchResponse>;
  getItem(sourceType: KnowledgeSourceType, id: string): Promise<KnowledgeItem | null>;
  summarize(args: KnowledgeProviderSearchArgs): Promise<KnowledgeSummaryResponse>;
}

export type KnowledgeFutureChatContext = {
  query: string;
  resultIds: string[];
  citations: Array<{
    sourceType: KnowledgeSourceType;
    itemId: string;
  }>;
  agentMode?: string;
};

export type KnowledgeMcpBridgeContract = {
  provider: 'local' | 'mcp';
  version: 'v1';
  searchMethod: 'knowledge.search';
  detailMethod: 'knowledge.getItem';
  summaryMethod: 'knowledge.summarize';
  chatContextShape: KnowledgeFutureChatContext;
};
