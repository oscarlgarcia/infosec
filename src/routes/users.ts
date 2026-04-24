import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { User, UserRoles } from '../db/mongo/models';
import { UserRole } from '../types';
import { verifyToken, requireRole } from '../middleware/auth';

interface CreateUserBody {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

interface UpdateUserBody {
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/users',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const users = await User.find({}, { password: 0 }).lean();
      return users;
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await User.findById(request.params.id, { password: 0 }).lean();
      if (!user) {
        return reply.code(404).send({ error: 'Not Found', message: 'User not found' });
      }
      return user;
    }
  );

  fastify.post<{ Body: CreateUserBody }>(
    '/users',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
      const { username, email, password, role } = request.body;

      if (!username || !email || !password) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Username, email and password are required' });
      }

      const existingUser = await User.findOne({
        $or: [{ username }, { email: email.toLowerCase() }]
      }).lean();

      if (existingUser) {
        return reply.code(409).send({ error: 'Conflict', message: 'Username or email already exists' });
      }

      if (role && !UserRoles.includes(role as typeof UserRoles[number])) {
        return reply.code(400).send({ error: 'Bad Request', message: `Invalid role. Must be one of: ${UserRoles.join(', ')}` });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await User.create({
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: role || 'usuario',
      });

      const userResponse = user.toObject();
      delete (userResponse as any).password;

      return reply.code(201).send(userResponse);
    }
  );

  fastify.put<{ Params: { id: string }; Body: UpdateUserBody }>(
    '/users/:id',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserBody }>, reply: FastifyReply) => {
      const { id } = request.params;
      const updates = request.body;

      const user = await User.findById(id).lean();
      if (!user) {
        return reply.code(404).send({ error: 'Not Found', message: 'User not found' });
      }

      if (updates.username) {
        const existingUsername = await User.findOne({ username: updates.username, _id: { $ne: id } }).lean();
        if (existingUsername) {
          return reply.code(409).send({ error: 'Conflict', message: 'Username already exists' });
        }
      }

      if (updates.email) {
        const existingEmail = await User.findOne({ email: updates.email.toLowerCase(), _id: { $ne: id } }).lean();
        if (existingEmail) {
          return reply.code(409).send({ error: 'Conflict', message: 'Email already exists' });
        }
      }

      if (updates.role && !UserRoles.includes(updates.role as typeof UserRoles[number])) {
        return reply.code(400).send({ error: 'Bad Request', message: `Invalid role. Must be one of: ${UserRoles.join(', ')}` });
      }

      const updateData: any = { ...updates };
      if (updates.email) updateData.email = updates.email.toLowerCase();
      if (updates.password) {
        updateData.password = await bcrypt.hash(updates.password, 12);
      }

      const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, select: '-password' }).lean();

      return updatedUser;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      if (request.user!.id === id) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Cannot delete your own account' });
      }

      const user = await User.findByIdAndDelete(id);
      if (!user) {
        return reply.code(404).send({ error: 'Not Found', message: 'User not found' });
      }

      return reply.code(204).send();
    }
  );

  fastify.put<{ Params: { id: string }; Body: { isActive: boolean } }>(
    '/users/:id/toggle-active',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { isActive: boolean } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { isActive } = request.body;

      const user = await User.findByIdAndUpdate(id, { isActive }, { new: true, select: '-password' }).lean();
      if (!user) {
        return reply.code(404).send({ error: 'Not Found', message: 'User not found' });
      }

      return user;
    }
  );
}
