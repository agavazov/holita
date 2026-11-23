import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type { QueryShopDashboardArgs } from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { DashboardService } from './dashboard.service.js';

@Resolver()
export class DashboardResolver {
  constructor(private readonly service: DashboardService) {}

  @Query('shopDashboard')
  dashboard(
    @Args() { period = 'DAYS_30' }: QueryShopDashboardArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.read(context, period);
  }
}
