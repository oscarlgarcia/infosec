export type Department = 'Cloud' | 'IT' | 'Development' | 'Compliance' | 'Legal';

export type UserRole = 'admin' | 'manager' | 'sme' | 'usuario';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type ClientType = 'Cloud' | 'Rent' | 'PS';

export type RequestType = 
  | 'RFI/RFP'
  | 'Customer Agreement Review'
  | 'Customer Agreements Execution'
  | 'InfoSec Support'
  | '3rd Party PT'
  | 'BC/DR Test Result Request'
  | 'Cloud Customer PT Request'
  | 'Certification Request'
  | 'Other Support';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  mimeType?: string;
  size?: number;
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string;
  clientType: ClientType;
  requestType?: RequestType;
  sectionToReview?: string;
  deadline?: Date;
  owner?: string;
  comments?: string;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientRequest {
  id: string;
  clientId: string;
  requestKey: string;
  requestType: RequestType;
  sectionToReview?: string;
  deadline?: Date;
  owner?: string;
  comments?: string;
  status: 'open' | 'in_progress' | 'completed';
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id?: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  clientId: string;
  title: string;
  agent: string;
  favorite: boolean;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  department: Department;
  content: string;
  embedding?: number[];
  metadata: {
    size: number;
    mimeType: string;
  };
  path?: string;
  createdAt: Date;
}

export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  department?: Department;
  source?: string;
}

export interface SearchResult {
  documentId: string;
  content: string;
  department: Department;
  score: number;
  source: string;
}

export interface AgentResponse {
  content: string;
  roles: (Department | 'Standard')[];
  docGapReport?: {
    question: string;
    coverage: 'Completa' | 'Parcial' | 'Nula';
    description: string;
    recommendedSection: Department | 'Indeterminado';
  };
}

export type KnowledgeSourceType = 'cms' | 'faq' | 'qa' | 'document';

export interface KnowledgeCitation {
  sourceType: KnowledgeSourceType;
  itemId: string;
  title: string;
  openTarget: string;
}

export interface KnowledgeSearchResult {
  id: string;
  sourceType: KnowledgeSourceType;
  title: string;
  snippet: string;
  content: string;
  score: number;
  openTarget: string;
  metadata: {
    sourceLabel: string;
    category?: string;
    tags?: string[];
    department?: Department;
    updatedAt?: Date;
    createdAt?: Date;
  };
}

export interface KnowledgeItem extends KnowledgeSearchResult {
  summary?: string;
}

export interface KnowledgeSearchResponse {
  query: string;
  results: KnowledgeSearchResult[];
  availableSourceTypes: KnowledgeSourceType[];
}

export interface KnowledgeSummaryResponse {
  query: string;
  summary: string;
  resultIds: string[];
  citations: KnowledgeCitation[];
}

export interface KnowledgeProvider {
  search(args: {
    query: string;
    sourceTypes?: KnowledgeSourceType[];
    limit?: number;
  }): Promise<KnowledgeSearchResponse>;
  getItem(sourceType: KnowledgeSourceType, id: string): Promise<KnowledgeItem | null>;
  summarize(args: {
    query: string;
    sourceTypes?: KnowledgeSourceType[];
    limit?: number;
  }): Promise<KnowledgeSummaryResponse>;
}
