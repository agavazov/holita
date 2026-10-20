import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetDailyDistanceArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { OverviewService } from './overview.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class OverviewResolver {
  constructor(private readonly overviewService: OverviewService) {}

  @Query('fleetOverview')
  fleetOverview(@Context() context: RequestContext) {
    return this.overviewService.overview(context);
  }

  @Query('fleetDailyDistance')
  fleetDailyDistance(
    @Args() args: QueryFleetDailyDistanceArgs,
    @Context() context: RequestContext,
  ) {
    return this.overviewService.dailyDistance(context, args);
  }
}
