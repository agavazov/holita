import { Injectable } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { CarsService } from '../cars/cars.service.js';
import { historyQuery, historyParameters, profileParameters } from './history-query.js';
import { tripsPage, eventsPage, drivingProfile } from './history-response.js';
import type {
  KarmaTripsInput,
  KarmaEventsInput,
  KarmaDrivingProfileInput,
} from '../../generated/graphql/types.js';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';
@Injectable()
export class HistoryService {
  constructor(
    private readonly karma: KarmaTransport,
    private readonly cars: CarsService,
  ) {}
  trips(input: KarmaTripsInput, context: RequestContext) {
    requireTenant(context);
    return this.getTrips(input, context);
  }
  events(input: KarmaEventsInput, context: RequestContext) {
    requireTenant(context);
    return this.getEvents(input, context);
  }
  profile(input: KarmaDrivingProfileInput, context: RequestContext) {
    requireTenant(context);
    return this.getDrivingProfile(input, context);
  }

  private async getTrips(input: KarmaTripsInput, context: RequestContext) {
    const query = historyQuery(input, 'trips');
    const signal = AbortSignal.timeout(4000);
    const car = await this.cars.find(query.carId, context, signal);
    if (!car) {
      return tripsPage([], query);
    }
    const result = tripsPage(
      await this.karma.read('trips', historyParameters(query), signal),
      query,
    );
    const last = result.items.at(-1);
    if (!result.hasMore && last && Number(last.id) > 1) {
      const older = {
        ...query,
        before: Number(last.id) - 1,
        snapshot: query.snapshot ?? Number(result.items[0]?.id),
      };
      const lookahead = tripsPage(
        await this.karma.read('trips', historyParameters(older), signal),
        older,
      );
      if (lookahead.items.length) {
        return { ...result, hasMore: true, nextCursor: lookahead.cursor };
      }
    }
    return result;
  }

  private async getEvents(input: KarmaEventsInput, context: RequestContext) {
    const query = historyQuery(input, 'events');
    const signal = AbortSignal.timeout(4000);
    const car = await this.cars.find(query.carId, context, signal);
    if (!car) {
      return eventsPage([], query);
    }
    return eventsPage(await this.karma.read('events', historyParameters(query), signal), query);
  }

  private async getDrivingProfile(input: KarmaDrivingProfileInput, context: RequestContext) {
    const parameters = profileParameters(input);
    const signal = AbortSignal.timeout(4000);
    const car = await this.cars.find(input.carId, context, signal);
    if (!car) {
      return null;
    }
    return drivingProfile(
      await this.karma.read('driving-profile', parameters, signal),
      input.carId,
    );
  }
}
