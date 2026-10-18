import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationRecordFleetOdometerReadingArgs,
  QueryFleetVehicleSamplesArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { TelemetryService } from './telemetry.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class TelemetryResolver {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Query('fleetDataClock')
  fleetDataClock(@Context() context: RequestContext) {
    return this.telemetryService.dataClock(context);
  }

  @Query('fleetVehicleSamples')
  fleetVehicleSamples(
    @Args() args: QueryFleetVehicleSamplesArgs,
    @Context() context: RequestContext,
  ) {
    return this.telemetryService.samples(context, args);
  }

  @Mutation('recordFleetOdometerReading')
  recordFleetOdometerReading(
    @Args() args: MutationRecordFleetOdometerReadingArgs,
    @Context() context: RequestContext,
  ) {
    return this.telemetryService.recordOdometerReading(context, args.input);
  }
}
