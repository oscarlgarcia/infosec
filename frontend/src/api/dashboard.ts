import { apiRequest } from './client';
import type { Client360, GlobalDashboard, Request360 } from '../types/request360';

export const dashboardApi = {
  global(windowDays = 90) {
    return apiRequest<GlobalDashboard>('/dashboard/global', { query: { windowDays } });
  },

  client(clientId: string) {
    return apiRequest<Client360>(`/dashboard/client/${clientId}`);
  },

  myWorkload() {
    return apiRequest<{ userId: string; open: number; overdue: number; requests: Request360[] }>(
      '/dashboard/my-workload'
    );
  },
};
