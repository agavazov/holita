import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetScenarioArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { ScenariosService } from './scenarios.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class ScenariosResolver {
  constructor(private readonly scenarios: ScenariosService) {}

  @Query('fleetScenario')
  fleetScenario(@Args() args: QueryFleetScenarioArgs, @Context() context: RequestContext) {
    return this.scenarios.find(context, args.id);
  }
}
