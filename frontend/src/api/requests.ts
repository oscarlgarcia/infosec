import { apiDownload, apiOpenAuthenticated, apiRequest } from './client';
import type {
  AiArtifact,
  Deliverable,
  Request360,
  Request360Detail,
  RequestDocument,
  RequestEvent,
  RequestThread,
  SlaSnapshot,
} from '../types/request360';

export interface RequestListFilters {
  status?: string;
  priority?: string;
  severity?: string;
  ownerId?: string;
  clientId?: string;
  requestType?: string;
  requestKind?: string;
  tag?: string;
  overdue?: boolean;
  slaState?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  includeClosed?: boolean;
}

export interface RequestListResponse {
  items: Request360[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateRequestPayload {
  clientId: string;
  requestType: string;
  requestKind?: string;
  title?: string;
  sectionToReview?: string;
  scope?: string;
  deadline?: string;
  owner?: string;
  comments?: string;
  priority?: string;
  severity?: string;
  requestChannel?: string;
  tags?: string[];
  businessUnit?: string;
  contractType?: string;
  contractSigned?: boolean;
  serviceModel?: string;
  salesOwnerId?: string;
  clientOwnerId?: string;
  infosecOwnerId?: string;
  infosecRepoUrl?: string;
  stakeholders?: Array<Record<string, any>>;
  overrideDuplicate?: boolean;
  [key: string]: any;
}

export interface UploadMetadata {
  documentType?: string;
  visibility?: string;
  classification?: string;
  threadId?: string;
  deliverableId?: string;
}

export const requestsApi = {
  list(filters: RequestListFilters = {}) {
    return apiRequest<RequestListResponse>('/requests', {
      query: {
        status: filters.status,
        priority: filters.priority,
        severity: filters.severity,
        ownerId: filters.ownerId,
        clientId: filters.clientId,
        requestType: filters.requestType,
        requestKind: filters.requestKind,
        tag: filters.tag,
        overdue: filters.overdue ? 'true' : undefined,
        slaState: filters.slaState,
        q: filters.q,
        from: filters.from,
        to: filters.to,
        page: filters.page,
        limit: filters.limit,
        includeClosed: filters.includeClosed ? 'true' : undefined,
      },
    });
  },

  get360(id: string) {
    return apiRequest<Request360Detail>(`/requests/${id}/360`);
  },

  get(id: string) {
    return apiRequest<Request360>(`/requests/${id}`);
  },

  myInbox() {
    return apiRequest<{ items: Request360[] }>('/requests/my-inbox');
  },

  checkDuplicates(payload: { clientId: string; requestType: string; title?: string; scope?: string; semantic?: boolean }) {
    return apiRequest<{ deterministic: any[]; semantic: any[] }>('/requests/check-duplicates', {
      method: 'POST',
      json: payload,
    });
  },

  classify(text: string) {
    return apiRequest<any>('/requests/intake/classify', { method: 'POST', json: { text } });
  },

  /** Creates a request as JSON (no files). */
  create(payload: CreateRequestPayload) {
    return apiRequest<Request360>('/requests', { method: 'POST', json: payload });
  },

  /** Creates a request with multipart files in a single call. */
  createWithFiles(payload: CreateRequestPayload, files: File[], metadata: UploadMetadata[] = []) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) || typeof value === 'object') {
        form.append(key, JSON.stringify(value));
      } else {
        form.append(key, String(value));
      }
    }
    files.forEach((file) => form.append('files', file));
    if (metadata.length) form.append('fileMetadata', JSON.stringify(metadata));
    return apiRequest<Request360>('/requests', { method: 'POST', body: form });
  },

  update(id: string, payload: Record<string, any>) {
    return apiRequest<Request360>(`/requests/${id}`, { method: 'PATCH', json: payload });
  },

  transition(id: string, status: string, reason?: string) {
    return apiRequest<Request360>(`/requests/${id}/status`, {
      method: 'POST',
      json: { status, reason },
    });
  },

  promote(id: string) {
    return apiRequest<Request360>(`/requests/${id}/promote`, { method: 'POST' });
  },

  softDelete(id: string, reason?: string) {
    return apiRequest<Request360>(`/requests/${id}`, { method: 'DELETE', json: { reason } });
  },

  restore(id: string) {
    return apiRequest<Request360>(`/requests/${id}/restore`, { method: 'POST' });
  },

  listEvents(id: string, params: { visibility?: string; type?: string; page?: number; limit?: number } = {}) {
    return apiRequest<{ items: RequestEvent[]; total: number; page: number; limit: number }>(
      `/requests/${id}/events`,
      { query: params as any }
    );
  },

  addEvent(id: string, payload: { type?: string; visibility?: string; body: string; threadId?: string; mentions?: string[] }) {
    return apiRequest<RequestEvent>(`/requests/${id}/events`, { method: 'POST', json: payload });
  },

  listThreads(id: string) {
    return apiRequest<{ items: RequestThread[] }>(`/requests/${id}/threads`);
  },

  createThread(id: string, payload: { type?: string; title: string; description?: string; parentThreadId?: string; assigneeId?: string; dueDate?: string }) {
    return apiRequest<RequestThread>(`/requests/${id}/threads`, { method: 'POST', json: payload });
  },

  updateThread(id: string, threadId: string, payload: Record<string, any>) {
    return apiRequest<RequestThread>(`/requests/${id}/threads/${threadId}`, { method: 'PATCH', json: payload });
  },

  closeThread(id: string, threadId: string) {
    return apiRequest<RequestThread>(`/requests/${id}/threads/${threadId}/close`, { method: 'POST' });
  },

  listDocuments(id: string) {
    return apiRequest<{ items: RequestDocument[] }>(`/requests/${id}/documents`);
  },

  uploadDocuments(id: string, files: File[], metadata: UploadMetadata[] = []) {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    if (metadata.length) form.append('fileMetadata', JSON.stringify(metadata));
    return apiRequest<{ documents: RequestDocument[]; duplicates: any[] }>(`/requests/${id}/documents`, {
      method: 'POST',
      body: form,
    });
  },

  deleteDocument(id: string, documentId: string) {
    return apiRequest<void>(`/requests/${id}/documents/${documentId}`, { method: 'DELETE' });
  },

  downloadDocument(id: string, documentId: string, filename: string) {
    return apiDownload(`/requests/${id}/documents/${documentId}/download`, filename);
  },

  listDeliverables(id: string, filters: { status?: string; threadId?: string } = {}) {
    return apiRequest<{ items: Deliverable[] }>(`/requests/${id}/deliverables`, { query: filters });
  },

  createDeliverable(id: string, payload: Record<string, any>) {
    return apiRequest<Deliverable>(`/requests/${id}/deliverables`, { method: 'POST', json: payload });
  },

  getDeliverable(id: string, deliverableId: string) {
    return apiRequest<Deliverable & { documents?: RequestDocument[] }>(
      `/requests/${id}/deliverables/${deliverableId}`
    );
  },

  updateDeliverable(id: string, deliverableId: string, payload: Record<string, any>) {
    return apiRequest<Deliverable>(`/requests/${id}/deliverables/${deliverableId}`, {
      method: 'PATCH',
      json: payload,
    });
  },

  sendDeliverable(id: string, deliverableId: string) {
    return apiRequest<Deliverable>(`/requests/${id}/deliverables/${deliverableId}/send`, { method: 'POST' });
  },

  getSla(id: string) {
    return apiRequest<SlaSnapshot>(`/requests/${id}/sla`);
  },

  listAiArtifacts(id: string) {
    return apiRequest<{ items: AiArtifact[] }>(`/requests/${id}/ai/artifacts`);
  },

  generateSummary(id: string) {
    return apiRequest<AiArtifact>(`/requests/${id}/ai/summary`, { method: 'POST', json: {} });
  },

  generateFollowupDraft(id: string, instructions?: string) {
    return apiRequest<AiArtifact>(`/requests/${id}/ai/followup-draft`, {
      method: 'POST',
      json: { instructions },
    });
  },

  generateMeetingMinutes(id: string) {
    return apiRequest<AiArtifact>(`/requests/${id}/ai/meeting-minutes`, { method: 'POST', json: {} });
  },

  acceptArtifact(artifactId: string, editedContent?: string) {
    return apiRequest<AiArtifact>(`/ai-artifacts/${artifactId}/accept`, {
      method: 'POST',
      json: { editedContent },
    });
  },

  discardArtifact(artifactId: string) {
    return apiRequest<AiArtifact>(`/ai-artifacts/${artifactId}/discard`, { method: 'POST' });
  },

  addFollowUp(id: string, payload: { dueAt: string; note?: string }) {
    return apiRequest<any>(`/requests/${id}/follow-ups`, { method: 'POST', json: payload });
  },

  downloadLogbookMarkdown(id: string, requestKey: string) {
    return apiDownload(`/requests/${id}/logbook.md`, `${requestKey}-logbook.md`);
  },

  openLogbookHtml(id: string) {
    return apiOpenAuthenticated(`/requests/${id}/logbook.html`);
  },
};
