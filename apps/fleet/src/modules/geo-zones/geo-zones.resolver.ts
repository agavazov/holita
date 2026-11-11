import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetGeoZoneEventsArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { GeoZonesService } from './geo-zones.service.js';

@Resolver('FleetGeoZone')
@UseGuards(FleetEnabledGuard)
export class GeoZonesResolver {
  constructor(private readonly geoZones: GeoZonesService) {}

  @Query('fleetGeoZones')
  fleetGeoZones(@Context() context: RequestContext) {
    return this.geoZones.zones(context);
  }

  @Query('fleetGeoZoneEvents')
  fleetGeoZoneEvents(
    @Args() args: QueryFleetGeoZoneEventsArgs,
    @Context() context: RequestContext,
  ) {
    return this.geoZones.events(context, args);
  }
}
