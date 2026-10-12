import { Injectable } from '@nestjs/common';
import { KarmaClient } from '../cars/karma-client.js';
import type { KarmaEdataInput } from '../generated/graphql/types.js';
import { requireTenant } from '../graphql/demo-auth.js';
import type { RequestContext } from '../graphql/request-context.js';

@Injectable()
export class EdataService {
  constructor(private readonly karma: KarmaClient) {}

  list(input: KarmaEdataInput, context: RequestContext) {
    requireTenant(context);
    return this.karma.getEdata(input);
  }
}
