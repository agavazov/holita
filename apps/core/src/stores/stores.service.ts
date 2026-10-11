import { BadRequestException, Injectable } from '@nestjs/common';
import { requireTenant } from '../graphql/demo-auth.js';
import type { RequestContext } from '../graphql/request-context.js';
import { isUUID } from 'class-validator';
import type { Store } from '../generated/graphql/types.js';
import { StoresRepository } from './stores.repository.js';

@Injectable()
export class StoresService {
  constructor(private readonly stores: StoresRepository) {}

  list(context: RequestContext): Promise<Store[]> {
    return this.stores.list(requireTenant(context));
  }

  find(context: RequestContext, id: string): Promise<Store | null> {
    const tenantId = requireTenant(context);
    if (typeof id !== 'string' || !isUUID(id))
      throw new BadRequestException('Store ID must be a UUID');
    return this.stores.find(tenantId, id.toLowerCase());
  }
}
