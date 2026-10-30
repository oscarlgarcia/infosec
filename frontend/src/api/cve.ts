import { apiRequest } from './client';
import type {
  CveAdvisory,
  CveCatalogResponse,
  CveImpact,
  CveMatch,
  CveRecord,
  CveSyncStatus,
  TechnologyInventoryItem,
} from '../types/request360';

export interface CveListResponse {
  items: CveAdvisory[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const cveApi = {
  list(filters: { severity?: string; status?: string; q?: string; page?: number; limit?: number } = {}) {
    return apiRequest<CveListResponse>('/cve-advisories', { query: filters });
  },

  get(id: string) {
    return apiRequest<CveAdvisory>(`/cve-advisories/${id}`);
  },

  create(payload: Record<string, any>) {
    return apiRequest<CveAdvisory>('/cve-advisories', { method: 'POST', json: payload });
  },

  update(id: string, payload: Record<string, any>) {
    return apiRequest<CveAdvisory>(`/cve-advisories/${id}`, { method: 'PUT', json: payload });
  },

  remove(id: string) {
    return apiRequest<void>(`/cve-advisories/${id}`, { method: 'DELETE' });
  },

  listImpacts(id: string) {
    return apiRequest<{ items: CveImpact[] }>(`/cve-advisories/${id}/impacts`);
  },

  upsertImpact(id: string, payload: Record<string, any>) {
    return apiRequest<CveImpact>(`/cve-advisories/${id}/impacts`, { method: 'POST', json: payload });
  },

  notify(id: string) {
    return apiRequest<any>(`/cve-advisories/${id}/notify`, { method: 'POST' });
  },

  draft(id: string, payload: { clientId: string; tone?: string }) {
    return apiRequest<{ cveId: string; clientId: string; content: string; model: string; tone: string }>(
      `/cve-advisories/${id}/draft`,
      { method: 'POST', json: payload }
    );
  },

  getSubscription(clientId: string) {
    return apiRequest<{ clientId: string; name: string; enabled: boolean; severityThreshold: string; recipients: string[] }>(
      `/clients/${clientId}/cve-subscriptions`
    );
  },

  updateSubscription(clientId: string, payload: Record<string, any>) {
    return apiRequest<{ clientId: string; enabled: boolean; severityThreshold: string; recipients: string[] }>(
      `/clients/${clientId}/cve-subscriptions`,
      { method: 'PUT', json: payload }
    );
  },

  listAllImpacts(filters: { clientId?: string; severity?: string; affected?: boolean } = {}) {
    return apiRequest<{ items: CveImpact[] }>('/cve-impacts', {
      query: {
        clientId: filters.clientId,
        severity: filters.severity,
        affected: filters.affected === undefined ? undefined : String(filters.affected),
      },
    });
  },

  catalog(filters: {
    q?: string;
    severity?: string;
    kev?: boolean;
    ransomware?: boolean;
    vendor?: string;
    product?: string;
    hasAdvisory?: boolean;
    matchedClientId?: string;
    publishedFrom?: string;
    publishedTo?: string;
    page?: number;
    limit?: number;
    sort?: string;
  } = {}) {
    return apiRequest<CveCatalogResponse>('/cve-catalog', {
      query: {
        q: filters.q,
        severity: filters.severity,
        kev: filters.kev === undefined ? undefined : String(filters.kev),
        ransomware: filters.ransomware === undefined ? undefined : String(filters.ransomware),
        vendor: filters.vendor,
        product: filters.product,
        hasAdvisory: filters.hasAdvisory === undefined ? undefined : String(filters.hasAdvisory),
        matchedClientId: filters.matchedClientId,
        publishedFrom: filters.publishedFrom,
        publishedTo: filters.publishedTo,
        page: filters.page,
        limit: filters.limit,
        sort: filters.sort,
      },
    });
  },

  catalogRecord(cveId: string) {
    return apiRequest<CveRecord>(`/cve-catalog/${cveId}`);
  },

  promote(cveId: string) {
    return apiRequest<{ advisory: CveAdvisory; created: boolean; impacts: number }>(
      `/cve-catalog/${cveId}/promote`,
      { method: 'POST' }
    );
  },

  rematchRecord(cveId: string) {
    return apiRequest<{ items: CveMatch[] }>(`/cve-catalog/${cveId}/match`, { method: 'POST' });
  },

  syncStatus() {
    return apiRequest<CveSyncStatus>('/cve-sync/status');
  },

  syncNvd(payload: { mode?: string; from?: string; to?: string } = {}) {
    return apiRequest<{ started: boolean; source: string; mode: string }>('/cve-sync/nvd', {
      method: 'POST',
      json: payload,
    });
  },

  syncKev(payload: { force?: boolean } = {}) {
    return apiRequest<{ started: boolean; source: string }>('/cve-sync/kev', {
      method: 'POST',
      json: payload,
    });
  },

  getTechnologyInventory(clientId: string) {
    return apiRequest<{ clientId: string; name: string; items: TechnologyInventoryItem[] }>(
      `/clients/${clientId}/technology-inventory`
    );
  },

  updateTechnologyInventory(clientId: string, items: TechnologyInventoryItem[]) {
    return apiRequest<{ clientId: string; name: string; items: TechnologyInventoryItem[]; rematchStarted?: boolean }>(
      `/clients/${clientId}/technology-inventory`,
      { method: 'PUT', json: { items } }
    );
  },

  rematchClient(clientId: string) {
    return apiRequest<{ clientId: string; scanned: number; changed: number }>(
      `/clients/${clientId}/technology-inventory/rematch`,
      { method: 'POST' }
    );
  },
};
