import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationCreateFleetVehicleGroupArgs,
  MutationDeleteFleetVehicleGroupArgs,
  MutationUpdateFleetVehicleGroupArgs,
  QueryFleetVehicleGroupArgs,
  QueryFleetVehicleGroupsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { VehicleGroupsService } from './vehicle-groups.service.js';

@Resolver('FleetVehicleGroup')
@UseGuards(FleetEnabledGuard)
export class VehicleGroupsResolver {
  constructor(private readonly groupsService: VehicleGroupsService) {}

  @Query('fleetVehicleGroups')
  fleetVehicleGroups(
    @Args() args: QueryFleetVehicleGroupsArgs,
    @Context() context: RequestContext,
  ) {
    return this.groupsService.list(context, args);
  }

  @Query('fleetVehicleGroup')
  fleetVehicleGroup(@Args() args: QueryFleetVehicleGroupArgs, @Context() context: RequestContext) {
    return this.groupsService.find(context, args.id);
  }

  @Mutation('createFleetVehicleGroup')
  createFleetVehicleGroup(
    @Args() args: MutationCreateFleetVehicleGroupArgs,
    @Context() context: RequestContext,
  ) {
    return this.groupsService.create(context, args.input);
  }

  @Mutation('updateFleetVehicleGroup')
  updateFleetVehicleGroup(
    @Args() args: MutationUpdateFleetVehicleGroupArgs,
    @Context() context: RequestContext,
  ) {
    return this.groupsService.update(context, args.id, args.input);
  }

  @Mutation('deleteFleetVehicleGroup')
  deleteFleetVehicleGroup(
    @Args() args: MutationDeleteFleetVehicleGroupArgs,
    @Context() context: RequestContext,
  ) {
    return this.groupsService.delete(context, args.id);
  }
}
