import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationCreateFleetGeoZoneArgs,
  MutationDeleteFleetGeoZoneArgs,
  MutationUpdateFleetGeoZoneArgs,
  QueryFleetGeoZoneEventsArgs,
} from '../../generated/graphql/types.js';
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

  @Mutation('createFleetGeoZone')
  createFleetGeoZone(
    @Args() args: MutationCreateFleetGeoZoneArgs,
    @Context() context: RequestContext,
  ) {
    return this.geoZones.create(context, args.input);
  }

  @Mutation('updateFleetGeoZone')
  updateFleetGeoZone(
    @Args() args: MutationUpdateFleetGeoZoneArgs,
    @Context() context: RequestContext,
  ) {
    return this.geoZones.update(context, args.id, args.input);
  }

  @Mutation('deleteFleetGeoZone')
  deleteFleetGeoZone(
    @Args() args: MutationDeleteFleetGeoZoneArgs,
    @Context() context: RequestContext,
  ) {
    return this.geoZones.delete(context, args.id);
  }
}
