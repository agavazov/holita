import { Injectable } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';

import { projects, timeZones, version } from './references-response.js';

@Injectable()
export class ReferencesService {
  constructor(private readonly karma: KarmaTransport) {}

  projects(context: RequestContext) {
    requireTenant(context);
    return this.karma.read('projects', new URLSearchParams()).then(projects);
  }

  timeZones(context: RequestContext) {
    requireTenant(context);
    return this.karma.read('time-zones', new URLSearchParams()).then(timeZones);
  }

  version(context: RequestContext) {
    requireTenant(context);
    return this.karma.readVersion().then(version);
  }
}
