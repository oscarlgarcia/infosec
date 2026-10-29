import { apiRequest } from './client';
import type { AppUser } from '../types/request360';

export const usersApi = {
  list() {
    return apiRequest<AppUser[]>('/users');
  },
};
