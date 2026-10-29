import { apiRequest } from './client';
import type { NotificationList, NotificationPreferences } from '../types/request360';

export const notificationsApi = {
  list(params: { unread?: boolean; page?: number; limit?: number } = {}) {
    return apiRequest<NotificationList>('/notifications', {
      query: {
        unread: params.unread ? 'true' : undefined,
        page: params.page,
        limit: params.limit,
      },
    });
  },

  markRead(id: string) {
    return apiRequest<any>(`/notifications/${id}/read`, { method: 'POST' });
  },

  markAllRead() {
    return apiRequest<any>('/notifications/read-all', { method: 'POST' });
  },

  getPreferences() {
    return apiRequest<NotificationPreferences>('/notification-preferences');
  },

  savePreferences(payload: Record<string, any>) {
    return apiRequest<NotificationPreferences>('/notification-preferences', { method: 'PUT', json: payload });
  },
};
