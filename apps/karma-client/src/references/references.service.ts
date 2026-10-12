import { Injectable } from '@nestjs/common';
import { KarmaClient } from '../cars/karma-client.js';
import { requireTenant } from '../graphql/demo-auth.js';
import type { RequestContext } from '../graphql/request-context.js';

@Injectable()
export class ReferencesService {
  constructor(private readonly karma: KarmaClient) {}

  projects(context: RequestContext) {
    requireTenant(context);
    return this.karma.listProjects();
  }

  timeZones(context: RequestContext) {
    requireTenant(context);
    return this.karma.listTimeZones();
  }

  version(context: RequestContext) {
    requireTenant(context);
    return this.karma.getVersion();
  }
}
