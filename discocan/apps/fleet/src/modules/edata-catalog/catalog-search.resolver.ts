import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetEdataParametersArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CatalogSearchService } from './catalog-search.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class CatalogSearchResolver {
  constructor(private readonly catalog: CatalogSearchService) {}

  @Query('fleetEdataProfiles')
  fleetEdataProfiles(@Context() context: RequestContext) {
    return this.catalog.profiles(context);
  }

  @Query('fleetEdataParameters')
  fleetEdataParameters(
    @Args() args: QueryFleetEdataParametersArgs,
    @Context() context: RequestContext,
  ) {
    return this.catalog.parameters(args.input, context);
  }
}
