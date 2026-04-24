import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '../types';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Fastify {
    interface FastifyRequest {
      user?: AuthUser;
    }
  }
}

export async function verifyToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await (request as any).jwtVerify();
    request.user = {
      id: decoded.sub,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!roles.includes(request.user.role as UserRole)) {
      return reply.code(403).send({ 
        error: 'Forbidden', 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }
  };
}

export const roleHierarchy: Record<UserRole, number> = {
  admin: 4,
  manager: 3,
  sme: 2,
  usuario: 1,
};

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}
