/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { User } from '../db/mongo/models';
import { verifyToken } from '../middleware/auth';
import { env } from '../config';

interface LoginBody {
  username: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  console.log('[AuthRoutes] Registering auth routes...');
  fastify.post<{ Body: LoginBody }>(
    '/auth/login',
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const { username, password } = request.body;

      if (!username || !password) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Username and password are required' });
      }

      const user = await User.findOne({ 
        $or: [{ username }, { email: username }] 
      }).lean();

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Account is deactivated' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

      const payload = {
        sub: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      };

      const accessToken = fastify.jwt.sign(payload as any);
      const refreshToken = fastify.jwt.sign(
        { sub: user._id.toString(), type: 'refresh' } as any,
        { secret: env.JWT_REFRESH_SECRET } as any
      );

      return {
        accessToken,
        refreshToken,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    }
  );

  fastify.post<{ Body: RefreshBody }>(
    '/auth/refresh',
    async (request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Refresh token is required' });
      }

      try {
        const decoded = fastify.jwt.verify(refreshToken, {
          secret: env.JWT_REFRESH_SECRET
        } as any) as any;

        if (decoded.type !== 'refresh') {
          return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
        }

        const user = await User.findById(decoded.sub).lean();
        if (!user || !user.isActive) {
          return reply.code(401).send({ error: 'Unauthorized', message: 'User not found or inactive' });
        }

        const payload = {
          sub: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        };

        const newAccessToken = fastify.jwt.sign(payload as any);
        const newRefreshToken = fastify.jwt.sign(
          { sub: user._id.toString(), type: 'refresh' } as any,
          { secret: env.JWT_REFRESH_SECRET } as any
        );

        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
      } catch (err) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
      }
    }
  );

  fastify.get(
    '/auth/me',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        id: request.user!.id,
        username: request.user!.username,
        email: request.user!.email,
        role: request.user!.role,
      };
    }
  );

  fastify.post(
    '/auth/logout',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send({ message: 'Logged out successfully' });
    }
  );
}
