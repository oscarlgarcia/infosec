import { apiDownload, apiDownloadRequest, apiOpenAuthenticated, apiRequest } from './client';
import type {
  EvidenceCriteriaCatalog,
  EvidenceImportResult,
  EvidenceItem,
  EvidenceListResponse,
  EvidenceMapping,
  EvidenceMatchResponse,
  EvidencePayload,
  EvidenceSuggestions,
} from '../types/evidence';

export interface EvidenceFilters {
  q?: string;
  domain?: string;
  area?: string;
  framework?: string;
  language?: string;
  shareMode?: string;
  origin?: string;
  documentType?: string;
  classification?: string;
  ndaRequired?: boolean;
  includeArchived?: boolean;
  status?: string;
  page?: number;
  limit?: number;
}

export interface KbDocumentOption {
  id: string;
  originalName: string;
  department?: string;
  path?: string;
  createdAt?: string;
}

function toQuery(filters: EvidenceFilters) {
  return {
    q: filters.q,
    domain: filters.domain,
    area: filters.area,
    framework: filters.framework,
    language: filters.language,
    shareMode: filters.shareMode,
    origin: filters.origin,
    documentType: filters.documentType,
    classification: filters.classification,
    ndaRequired: filters.ndaRequired === undefined ? undefined : String(filters.ndaRequired),
    includeArchived: filters.includeArchived === undefined ? undefined : String(filters.includeArchived),
    status: filters.status,
    page: filters.page,
    limit: filters.limit,
  };
}

function querySuffix(filters: EvidenceFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toQuery({ ...filters, page: undefined, limit: undefined }))) {
    if (value === null || value === undefined || value === '') continue;
    params.append(key, String(value));
  }
  return params.toString() ? `?${params.toString()}` : '';
}

export const evidenceApi = {
  list(filters: EvidenceFilters = {}) {
    return apiRequest<EvidenceListResponse>('/evidence', { query: toQuery(filters) });
  },

  areas() {
    return apiRequest<{ items: string[] }>('/evidence/areas');
  },

  suggestions() {
    return apiRequest<EvidenceSuggestions>('/evidence/suggestions');
  },

  catalogs() {
    return apiRequest<EvidenceCriteriaCatalog>('/catalogs');
  },

  updateCatalog(name: 'evidenceDomains' | 'evidenceFrameworks', values: string[]) {
    return apiRequest<{ name: string; values: string[] }>(`/catalogs/${name}`, {
      method: 'PUT',
      json: { values },
    });
  },

  get(id: string) {
    return apiRequest<EvidenceItem>(`/evidence/${id}`);
  },

  create(payload: EvidencePayload) {
    return apiRequest<EvidenceItem>('/evidence', { method: 'POST', json: payload });
  },

  update(id: string, payload: Partial<EvidencePayload> & { archived?: boolean }) {
    return apiRequest<EvidenceItem>(`/evidence/${id}`, { method: 'PATCH', json: payload });
  },

  uploadAsset(id: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<EvidenceItem>(`/evidence/${id}/asset`, { method: 'POST', body });
  },

  removeAsset(id: string) {
    return apiRequest<EvidenceItem>(`/evidence/${id}/asset`, { method: 'DELETE' });
  },

  download(item: EvidenceItem) {
    return apiDownload(`/evidence/${item.id}/download`, item.asset?.originalName || `evidence-${item.id}`);
  },

  open(item: EvidenceItem) {
    return apiOpenAuthenticated(`/evidence/${item.id}/download`);
  },

  async exportCsv(filters: EvidenceFilters = {}) {
    const stamp = new Date().toISOString().slice(0, 10);
    return apiDownload(`/evidence/export${querySuffix(filters)}`, `matriz-evidencias-${stamp}.csv`);
  },

  async exportXlsx(filters: EvidenceFilters = {}) {
    const stamp = new Date().toISOString().slice(0, 10);
    return apiDownload(`/evidence/export.xlsx${querySuffix(filters)}`, `matriz-evidencias-${stamp}.xlsx`);
  },

  importXlsx(file: File) {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<EvidenceImportResult>('/evidence/import', { method: 'POST', body });
  },

  zip(ids: string[]) {
    const stamp = new Date().toISOString().slice(0, 10);
    return apiDownloadRequest('/evidence/zip', `evidencias-${stamp}.zip`, {
      method: 'POST',
      json: { ids },
    });
  },

  match(q: string, limit = 5) {
    return apiRequest<EvidenceMatchResponse>('/evidence/match', { query: { q, limit } });
  },

  listMappings(q?: string) {
    return apiRequest<{ items: EvidenceMapping[] }>('/evidence/mappings', { query: { q } });
  },

  createMapping(payload: { requirement: string; evidenceId: string; language?: string; notes?: string }) {
    return apiRequest<EvidenceMapping>('/evidence/mappings', { method: 'POST', json: payload });
  },

  updateMapping(id: string, payload: { language?: string; notes?: string }) {
    return apiRequest<EvidenceMapping>(`/evidence/mappings/${id}`, { method: 'PATCH', json: payload });
  },

  deleteMapping(id: string) {
    return apiRequest<{ deleted: boolean }>(`/evidence/mappings/${id}`, { method: 'DELETE' });
  },

  importMappings(file: File) {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<EvidenceImportResult>('/evidence/mappings/import', { method: 'POST', body });
  },

  async kbDocuments() {
    const docs = await apiRequest<KbDocumentOption[]>('/kb/documents');
    return Array.isArray(docs) ? docs : [];
  },
};
