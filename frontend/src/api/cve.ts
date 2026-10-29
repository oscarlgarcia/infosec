import { apiRequest } from './client';
import type { CveAdvisory, CveImpact } from '../types/request360';

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
};
