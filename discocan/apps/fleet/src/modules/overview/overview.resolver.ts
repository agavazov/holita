import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  QueryFleetDailyDistanceArgs,
  QueryFleetDashboardArgs,
  QueryFleetMapArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { OverviewService } from './overview.service.js';
import { DashboardService } from './dashboard.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class OverviewResolver {
  constructor(
    private readonly overviewService: OverviewService,
    private readonly dashboard: DashboardService,
  ) {}

  @Query('fleetDashboard')
  fleetDashboard(@Args() args: QueryFleetDashboardArgs, @Context() context: RequestContext) {
    return this.dashboard.dashboard(context, args);
  }

  @Query('fleetMap')
  fleetMap(@Args() args: QueryFleetMapArgs, @Context() context: RequestContext) {
    return this.dashboard.map(context, args);
  }

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
