import { Injectable } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';

import { users, roles } from './accounts-response.js';

@Injectable()
export class AccountsService {
  constructor(private readonly karma: KarmaTransport) {}
  users(context: RequestContext) {
    requireTenant(context);
    return this.karma.read('users', new URLSearchParams()).then(users);
  }
  roles(context: RequestContext) {
    requireTenant(context);
    return this.karma.read('roles', new URLSearchParams()).then(roles);
  }
}
