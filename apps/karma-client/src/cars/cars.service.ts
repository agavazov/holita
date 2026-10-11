import { Injectable } from '@nestjs/common';
import { KarmaClient } from './karma-client.js';
import { requireTenant } from '../graphql/demo-auth.js';
import type { RequestContext } from '../graphql/request-context.js';

@Injectable()
export class CarsService {
  constructor(private readonly karma: KarmaClient) {}

  list(context: RequestContext) {
    requireTenant(context);
    // This account's cars are intentionally shared by all authenticated tenants.
    return this.karma.listCars();
  }
}
