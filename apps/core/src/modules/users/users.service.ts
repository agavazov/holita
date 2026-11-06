import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { normalizedEmail, userName, validatePassword } from '../../auth/account-input.js';
import { hashPassword } from '../../auth/password.js';
import { requireSession } from '../../auth/session.js';
import type { User } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { UsersRepository } from './users.repository.js';

function userId(value: string): string {
  if (!isUUID(value)) {
    throw new BadRequestException('User ID must be a UUID');
  }
  return value.toLowerCase();
}

function userWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new NotFoundException('User not found');
    }
    if (error.code === 'P2002') {
      const message = 'Email is already in use';
      throw new BadRequestException({
        message,
        fieldErrors: [{ path: 'email', message, code: 'DUPLICATE' }],
      });
    }
  }
  throw error;
}

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  list(context: RequestContext): Promise<User[]> {
    return this.users.list(requireSession(context).tenantId);
  }

  async me(context: RequestContext): Promise<User> {
    const identity = requireSession(context);
    const user = await this.users.find(identity.tenantId, identity.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(
    context: RequestContext,
    name: string,
    email: string,
    password: string,
  ): Promise<User> {
    const { tenantId } = requireSession(context);
    const normalizedName = userName(name);
    const normalized = normalizedEmail(email);
    const passwordHash = await hashPassword(validatePassword(password));
    try {
      return await this.users.create(tenantId, normalizedName, normalized, passwordHash);
    } catch (error: unknown) {
      return userWriteError(error);
    }
  }

  updateProfile(context: RequestContext, name: string, email: string): Promise<User> {
    return this.update(context, requireSession(context).userId, name, email);
  }

  async update(context: RequestContext, id: string, name: string, email: string): Promise<User> {
    const { tenantId } = requireSession(context);
    const recordId = userId(id);
    const normalizedName = userName(name);
    const normalized = normalizedEmail(email);
    try {
      return await this.users.update(tenantId, recordId, normalizedName, normalized);
    } catch (error: unknown) {
      return userWriteError(error);
    }
  }

  async setActive(context: RequestContext, id: string, active: boolean): Promise<User> {
    const { tenantId } = requireSession(context);
    const recordId = userId(id);
    try {
      return await this.users.setActive(tenantId, recordId, active);
    } catch (error: unknown) {
      return userWriteError(error);
    }
  }
}
