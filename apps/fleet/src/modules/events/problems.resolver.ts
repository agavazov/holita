import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetProblemsArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { ProblemsService } from './problems.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class ProblemsResolver {
  constructor(private readonly problems: ProblemsService) {}

  @Query('fleetProblems')
  fleetProblems(@Args() args: QueryFleetProblemsArgs, @Context() context: RequestContext) {
    return this.problems.list(context, args);
  }
}
