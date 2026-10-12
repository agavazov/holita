import { Injectable } from '@nestjs/common';
import { KarmaClient } from '../cars/karma-client.js';
import type {
  KarmaTripsInput,
  KarmaEventsInput,
  KarmaDrivingProfileInput,
} from '../generated/graphql/types.js';
import { requireTenant } from '../graphql/demo-auth.js';
import type { RequestContext } from '../graphql/request-context.js';
@Injectable()
export class HistoryService {
  constructor(private readonly karma: KarmaClient) {}
  trips(input: KarmaTripsInput, context: RequestContext) {
    requireTenant(context);
    return this.karma.getTrips(input);
  }
  events(input: KarmaEventsInput, context: RequestContext) {
    requireTenant(context);
    return this.karma.getEvents(input);
  }
  profile(input: KarmaDrivingProfileInput, context: RequestContext) {
    requireTenant(context);
    return this.karma.getDrivingProfile(input);
  }
}
