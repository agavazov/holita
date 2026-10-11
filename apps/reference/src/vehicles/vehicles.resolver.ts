import { UseGuards } from '@nestjs/common';
import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
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
  MutationCreateReferenceVehicleArgs,
  MutationDeleteReferenceVehicleArgs,
  MutationUpdateReferenceVehicleArgs,
  ReferenceVehicle,
  QueryReferenceVehicleArgs,
  QueryReferenceVehiclesArgs,
  Store,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { VehiclesService, type VehicleResult } from './vehicles.service.js';

@Resolver('ReferenceVehicle')
@UseGuards(ReferenceEnabledGuard)
export class VehiclesResolver {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Query('referenceVehicles')
  referenceVehicles(@Args() args: QueryReferenceVehiclesArgs, @Context() context: RequestContext) {
    return this.vehiclesService.list(context, args);
  }

  @Query('referenceVehicle')
  referenceVehicle(@Args() args: QueryReferenceVehicleArgs, @Context() context: RequestContext) {
    return this.vehiclesService.find(context, args.id);
  }

  @Mutation('createReferenceVehicle')
  createReferenceVehicle(
    @Args() args: MutationCreateReferenceVehicleArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.create(context, args.input);
  }

  @Mutation('updateReferenceVehicle')
  updateReferenceVehicle(
    @Args() args: MutationUpdateReferenceVehicleArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.update(context, args.id, args.input);
  }

  @Mutation('deleteReferenceVehicle')
  deleteReferenceVehicle(
    @Args() args: MutationDeleteReferenceVehicleArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<ReferenceVehicle, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.find(context, reference.id);
  }

  @ResolveField('store')
  store(@Parent() vehicle: VehicleResult): Store {
    return { __typename: 'Store', id: vehicle.storeId };
  }
}
