import { apiRequest } from './client';
import type { Client } from '../types';

export const clientsApi = {
  list() {
    return apiRequest<Client[]>('/clients');
  },

  get(id: string) {
    return apiRequest<Client>(`/clients/${id}`);
  },

  create(payload: { name: string; clientType: string; country?: string; contact?: string }) {
    return apiRequest<Client>('/clients', { method: 'POST', json: payload });
  },

  update(id: string, payload: Record<string, any>) {
    return apiRequest<Client>(`/clients/${id}`, { method: 'PUT', json: payload });
  },

  saveDirectory(id: string, payload: { localPath: string }) {
    return apiRequest<Client>(`/clients/${id}/directory`, { method: 'PUT', json: payload });
  },

  deleteDirectory(id: string) {
    return apiRequest<Client>(`/clients/${id}/directory`, { method: 'DELETE' });
  },

  requests(id: string) {
    return apiRequest<any[]>(`/clients/${id}/requests`);
  },
};
