import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetTripArgs, QueryFleetTripsArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { TripsService } from './trips.service.js';

@Resolver('FleetTrip')
@UseGuards(FleetEnabledGuard)
export class TripsResolver {
  constructor(private readonly tripsService: TripsService) {}

  @Query('fleetTrips')
  fleetTrips(@Args() args: QueryFleetTripsArgs, @Context() context: RequestContext) {
    return this.tripsService.list(context, args);
  }

  @Query('fleetTrip')
  fleetTrip(@Args() args: QueryFleetTripArgs, @Context() context: RequestContext) {
    return this.tripsService.find(context, args.id);
  }
}
