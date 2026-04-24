import { UserRole } from '../types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      username: string;
      email: string;
      role: UserRole;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      username: string;
      email: string;
      role: string;
    };
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
    };
  }
}
