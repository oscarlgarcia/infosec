import { apiRequest } from './client';
import type { BusinessCalendar, SlaPolicy } from '../types/request360';

export interface Catalogs {
  requestTypes: string[];
  contractTypes: string[];
  serviceModels: string[];
  [key: string]: string[];
}

export const slaApi = {
  listPolicies() {
    return apiRequest<{ items: SlaPolicy[] }>('/sla-policies');
  },

  createPolicy(payload: Record<string, any>) {
    return apiRequest<SlaPolicy>('/sla-policies', { method: 'POST', json: payload });
  },

  updatePolicy(id: string, payload: Record<string, any>) {
    return apiRequest<SlaPolicy>(`/sla-policies/${id}`, { method: 'PUT', json: payload });
  },

  deletePolicy(id: string) {
    return apiRequest<void>(`/sla-policies/${id}`, { method: 'DELETE' });
  },

  listCalendars() {
    return apiRequest<{ items: BusinessCalendar[] }>('/business-calendars');
  },

  createCalendar(payload: Record<string, any>) {
    return apiRequest<BusinessCalendar>('/business-calendars', { method: 'POST', json: payload });
  },

  updateCalendar(id: string, payload: Record<string, any>) {
    return apiRequest<BusinessCalendar>(`/business-calendars/${id}`, { method: 'PUT', json: payload });
  },

  deleteCalendar(id: string) {
    return apiRequest<void>(`/business-calendars/${id}`, { method: 'DELETE' });
  },

  getCatalogs() {
    return apiRequest<Catalogs>('/catalogs');
  },

  runSweep() {
    return apiRequest<any>('/sla/run-sweep', { method: 'POST' });
  },
};
