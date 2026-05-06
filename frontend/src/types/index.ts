export interface Client {
  id: string;
  name: string;
  clientType: 'Cloud' | 'Rent' | 'PS';
  country?: string;
  contact?: string;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

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

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
}

export interface ClientRequest {
  id: string;
  clientId: string;
  requestKey: string;
  requestType: RequestType;
  sectionToReview?: string;
  deadline?: string;
  owner?: string;
  comments?: string;
  status: 'open' | 'in_progress' | 'completed';
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  clientId: string;
  requestId?: string;
  title: string;
  agent: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  // NUEVOS CAMPOS PARA METADATOS RAG
  metadata?: {
    confidence?: number;
    coverage_status?: 'covered' | 'partial' | 'uncovered' | 'weak' | 'contradictory' | 'human_review';
    flags?: string[];
    citations?: Array<{ fileId?: string; filename?: string; score?: number; snippet?: string }>;
    used_sources?: Array<{ sourceType: string; itemId: string; title: string; score: number }>;
    response_id?: string;
  };
}

export interface Conversation extends Chat {
  requestId?: string;
  messages: Message[];
}

export interface Agent {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  type: 'standard' | 'infosec' | 'compliance' | 'it' | 'cloud' | 'legal' | 'dev' | 'gap-analysis' | 'custom';
  instructions: string;
  isSystem: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnswerRule {
  _id: string;
  name: string;
  content: string;
  domain?: string;
  appliesTo?: string[];  // Agent names this rule applies to (empty = all agents)
  enabled: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskList {
  _id: string;
  name: string;
  order: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  _id: string;
  name: string;
  description?: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  dueDate?: string;
  startDate?: string;
  createdAt: string;
  listId: TaskList | string;
  requestId?: any;
  checklist: Array<{ text: string; completed: boolean; order: number }>;
  labelIds: Array<{ _id: string; name: string; color: string }> | string[];
}

export type UserRole = 'admin' | 'manager' | 'sme' | 'usuario';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
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
  highlightedSnippet?: string;
  content: string;
  score: number;
  openTarget: string;
  metadata: {
    sourceLabel: string;
    category?: string;
    tags?: string[];
    department?: string;
    updatedAt?: string;
    createdAt?: string;
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

export interface AnalyticsOverview {
  windowDays: number;
  total_queries: number;
  unique_users: number;
  sessions_started: number;
  avg_session_length: number;
  avg_messages_per_session: number;
  top_domains: Array<{ domain: string; count: number }>;
  latency_avg_ms: number;
  latency_p95_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_estimate: number;
}

export interface AnalyticsCoverageGaps {
  windowDays: number;
  coverage_rate_by_domain: Array<{
    domain: string;
    covered: number;
    partial: number;
    uncovered: number;
    contradictory: number;
  }>;
  top_gap_items: Array<{
    gap_id: string;
    domain: string;
    subdomain?: string;
    question_example: string;
    frequency: number;
    impact_score: number;
    coverage_score: number;
    status: string;
  }>;
}

export interface AnalyticsQuality {
  windowDays: number;
  total_responses: number;
  answer_with_citation_rate: number;
  fallback_rate: number;
  legal_review_rate: number;
  contradiction_flag_rate: number;
  avg_confidence: number;
  accepted_rate: number;
  edited_rate: number;
  discarded_rate: number;
  copy_answer_rate: number;
  export_rate: number;
  feedback_events: number;
}

export interface AnalyticsFreshness {
  stale_days_threshold: number;
  total_documents: number;
  stale_documents_count: number;
  stale_canonical_answers_count: number;
  unused_documents_count: number;
  stale_documents: Array<{
    document_id: string;
    title: string;
    age_days: number;
    stale: boolean;
    times_retrieved: number;
  }>;
  stale_canonical_answers: Array<{
    canonical_id: string;
    question: string;
    domain: string;
    age_days: number;
    stale: boolean;
  }>;
  unused_documents: Array<{
    document_id: string;
    title: string;
    updated_at: string;
  }>;
}

export interface AnalyticsRecommendations {
  generated_at: string;
  recommendations: Array<{
    priority: number;
    type: string;
    title: string;
    detail: string;
  }>;
}

export interface AnalyticsTrends {
  windowDays: number;
  series: Array<{
    date: string;
    queries: number;
    cost: number;
    avg_latency_ms: number;
  }>;
}

export interface AnalyticsQuestionClusters {
  windowDays: number;
  clusters: Array<{
    cluster_key: string;
    count: number;
    top_domain: string;
    samples: string[];
  }>;
}

export interface AnalyticsOpportunities {
  generated_at: string;
  opportunities: Array<{
    gap_id: string;
    domain: string;
    subdomain?: string;
    status: string;
    owner: string;
    recommended_action: string;
    opportunity_score: number;
    question_example: string;
    frequency: number;
    impact_score: number;
    coverage_score: number;
  }>;
}

export interface AnalyticsClientOverview {
  windowDays: number;
  client_id: string;
  total_queries: number;
  total_feedback: number;
  sessions: number;
  avg_confidence: number;
  legal_review_rate: number;
  contradiction_rate: number;
  top_domains: Array<{ domain: string; count: number }>;
}

export interface ContradictionAnalysisResponse {
  question: string;
  domain: string;
  contradiction_score: number;
  findings: Array<{
    severity: 'low' | 'medium' | 'high';
    type: string;
    left: string;
    right: string;
    reason: string;
    score: number;
  }>;
}

export interface KbCandidate {
  _id: string;
  sessionId: string;
  question: string;
  suggestedAnswer: string;
  domain?: string;
  sourceRefs: string[];
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}
