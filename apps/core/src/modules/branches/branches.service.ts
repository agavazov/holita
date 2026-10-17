import { BadRequestException, Injectable } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { isUUID } from 'class-validator';
import type { Branch } from '../../generated/graphql/types.js';
import { BranchesRepository } from './branches.repository.js';

@Injectable()
export class BranchesService {
  constructor(private readonly branches: BranchesRepository) {}

  list(context: RequestContext): Promise<Branch[]> {
    return this.branches.list(requireTenant(context));
  }

  find(context: RequestContext, id: string): Promise<Branch | null> {
    const tenantId = requireTenant(context);
    if (typeof id !== 'string' || !isUUID(id))
      throw new BadRequestException('Branch ID must be a UUID');
    return this.branches.find(tenantId, id.toLowerCase());
  }
}
