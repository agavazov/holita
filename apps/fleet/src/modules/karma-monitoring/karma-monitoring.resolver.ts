import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationUpdateFleetKarmaMonitoringSettingsArgs,
  QueryFleetKarmaMonitoringEventsArgs,
  QueryFleetKarmaMonitoringTrucksArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { KarmaMonitoringService } from './karma-monitoring.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class KarmaMonitoringResolver {
  constructor(private readonly monitoring: KarmaMonitoringService) {}
  @Query('fleetKarmaMonitoringSettings')
  settings(@Context() context: RequestContext) {
    return this.monitoring.settings(context);
  }
  @Mutation('updateFleetKarmaMonitoringSettings')
  update(
    @Context() context: RequestContext,
    @Args() args: MutationUpdateFleetKarmaMonitoringSettingsArgs,
  ) {
    return this.monitoring.updateSettings(context, args.input);
  }
  @Query('fleetKarmaMonitoringTrucks')
  trucks(@Context() context: RequestContext, @Args() args: QueryFleetKarmaMonitoringTrucksArgs) {
    return this.monitoring.trucks(context, args);
  }
  @Query('fleetKarmaMonitoringEvents')
  events(@Context() context: RequestContext, @Args() args: QueryFleetKarmaMonitoringEventsArgs) {
    return this.monitoring.events(context, args);
  }
}
