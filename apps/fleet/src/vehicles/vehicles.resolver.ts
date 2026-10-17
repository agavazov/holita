import { UseGuards } from '@nestjs/common';
import { FleetEnabledGuard } from '../fleet-enabled.guard.js';
import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import type {
  MutationCreateFleetVehicleArgs,
  MutationDeleteFleetVehicleArgs,
  MutationUpdateFleetVehicleArgs,
  FleetVehicle,
  QueryFleetVehicleArgs,
  QueryFleetVehiclesArgs,
  Branch,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { VehiclesService, type VehicleResult } from './vehicles.service.js';

@Resolver('FleetVehicle')
@UseGuards(FleetEnabledGuard)
export class VehiclesResolver {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Query('fleetVehicles')
  fleetVehicles(@Args() args: QueryFleetVehiclesArgs, @Context() context: RequestContext) {
    return this.vehiclesService.list(context, args);
  }

  @Query('fleetVehicle')
  fleetVehicle(@Args() args: QueryFleetVehicleArgs, @Context() context: RequestContext) {
    return this.vehiclesService.find(context, args.id);
  }

  @Mutation('createFleetVehicle')
  createFleetVehicle(
    @Args() args: MutationCreateFleetVehicleArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.create(context, args.input);
  }

  @Mutation('updateFleetVehicle')
  updateFleetVehicle(
    @Args() args: MutationUpdateFleetVehicleArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.update(context, args.id, args.input);
  }

  @Mutation('deleteFleetVehicle')
  deleteFleetVehicle(
    @Args() args: MutationDeleteFleetVehicleArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<FleetVehicle, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.find(context, reference.id);
  }

  @ResolveField('branch')
  branch(@Parent() vehicle: VehicleResult): Branch {
    return { __typename: 'Branch', id: vehicle.branchId };
  }
}
