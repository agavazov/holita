import { Injectable } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import type { KarmaEdataInput } from '../../generated/graphql/types.js';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';

import { edataParameters, edataQuery } from './edata-query.js';
import { edataPage } from './edata-response.js';

@Injectable()
export class EdataService {
  constructor(private readonly karma: KarmaTransport) {}

  list(input: KarmaEdataInput, context: RequestContext) {
    requireTenant(context);
    return this.read(input);
  }

  private async read(input: KarmaEdataInput) {
    const query = edataQuery(input);
    const data = await this.karma.read('edata', edataParameters(query));
    return edataPage(data, query);
  }
}
