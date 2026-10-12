import { Injectable } from '@nestjs/common';
import { KarmaClient } from '../cars/karma-client.js';
import { requireTenant } from '../graphql/demo-auth.js';
import type { RequestContext } from '../graphql/request-context.js';

@Injectable()
export class LocationService {
  constructor(private readonly karma: KarmaClient) {}

  find(carId: string, context: RequestContext) {
    requireTenant(context);
    return this.karma.getLocation(carId);
  }
}
