import { Injectable } from '@nestjs/common';
import { KarmaClient } from '../cars/karma-client.js';
import { requireTenant } from '../graphql/demo-auth.js';
import type { RequestContext } from '../graphql/request-context.js';

@Injectable()
export class AccountsService {
  constructor(private readonly karma: KarmaClient) {}
  users(context: RequestContext) {
    requireTenant(context);
    return this.karma.listUsers();
  }
  roles(context: RequestContext) {
    requireTenant(context);
    return this.karma.listRoles();
  }
}
