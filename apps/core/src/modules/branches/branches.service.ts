import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { isUUID } from 'class-validator';
import type { Branch } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BranchesRepository } from './branches.repository.js';

@Injectable()
export class BranchesService {
  constructor(private readonly branches: BranchesRepository) {}

  list(context: RequestContext): Promise<Branch[]> {
    return this.branches.list(requireTenant(context));
  }

  find(context: RequestContext, id: string): Promise<Branch | null> {
    const tenantId = requireTenant(context);
    if (typeof id !== 'string' || !isUUID(id)) {
      throw new BadRequestException('Branch ID must be a UUID');
    }
    return this.branches.find(tenantId, id.toLowerCase());
  }

  async updateName(context: RequestContext, id: string, name: string): Promise<Branch> {
    const tenantId = requireTenant(context);
    if (!context.branchId || !isUUID(context.branchId)) {
      throw new BadRequestException('Select a Branch with a valid x-branch-id.');
    }
    if (!isUUID(id)) {
      throw new BadRequestException('Branch ID must be a UUID');
    }
    const recordId = id.toLowerCase();
    if (context.branchId.toLowerCase() !== recordId) {
      throw new BadRequestException('Branch ID must match the selected Branch.');
    }
    const trimmed = name.trim();
    if (!trimmed || Array.from(trimmed).length > 80 || trimmed.includes('\u0000')) {
      const message = 'Use 1 to 80 supported characters.';
      throw new BadRequestException({ message, fieldErrors: [{ path: 'name', message }] });
    }
    try {
      return await this.branches.updateName(tenantId, recordId, trimmed);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Branch not found');
      }
      throw error;
    }
  }
}
