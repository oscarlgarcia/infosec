import { apiRequest } from './client';
import type { Contract } from '../types/request360';

export const contractsApi = {
  list(clientId: string) {
    return apiRequest<{ items: Contract[] }>(`/clients/${clientId}/contracts`);
  },

  get(id: string) {
    return apiRequest<Contract>(`/contracts/${id}`);
  },

  create(clientId: string, payload: Record<string, any>) {
    return apiRequest<Contract>(`/clients/${clientId}/contracts`, { method: 'POST', json: payload });
  },

  update(id: string, payload: Record<string, any>) {
    return apiRequest<Contract>(`/contracts/${id}`, { method: 'PUT', json: payload });
  },

  sign(id: string) {
    return apiRequest<Contract>(`/contracts/${id}/sign`, { method: 'POST' });
  },

  renew(id: string, payload: Record<string, any> = {}) {
    return apiRequest<Contract>(`/contracts/${id}/renew`, { method: 'POST', json: payload });
  },

  cancel(id: string, payload: { reason?: string; cancelledAt?: string } = {}) {
    return apiRequest<Contract>(`/contracts/${id}/cancel`, { method: 'POST', json: payload });
  },

  uploadAttachment(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return apiRequest(`/contracts/${id}/attachments`, { method: 'POST', body: form });
  },
};
