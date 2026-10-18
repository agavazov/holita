import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationCreateFleetDriverArgs,
  MutationDeleteFleetDriverArgs,
  MutationUpdateFleetDriverArgs,
  QueryFleetDriverArgs,
  QueryFleetDriversArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { DriversService } from './drivers.service.js';

@Resolver('FleetDriver')
@UseGuards(FleetEnabledGuard)
export class DriversResolver {
  constructor(private readonly driversService: DriversService) {}

  @Query('fleetDrivers')
  fleetDrivers(@Args() args: QueryFleetDriversArgs, @Context() context: RequestContext) {
    return this.driversService.list(context, args);
  }

  @Query('fleetDriver')
  fleetDriver(@Args() args: QueryFleetDriverArgs, @Context() context: RequestContext) {
    return this.driversService.find(context, args.id);
  }

  @Mutation('createFleetDriver')
  createFleetDriver(
    @Args() args: MutationCreateFleetDriverArgs,
    @Context() context: RequestContext,
  ) {
    return this.driversService.create(context, args.input);
  }

  @Mutation('updateFleetDriver')
  updateFleetDriver(
    @Args() args: MutationUpdateFleetDriverArgs,
    @Context() context: RequestContext,
  ) {
    return this.driversService.update(context, args.id, args.input);
  }

  @Mutation('deleteFleetDriver')
  deleteFleetDriver(
    @Args() args: MutationDeleteFleetDriverArgs,
    @Context() context: RequestContext,
  ) {
    return this.driversService.delete(context, args.id);
  }
}
