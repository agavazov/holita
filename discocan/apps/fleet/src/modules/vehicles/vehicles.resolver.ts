import { UseGuards } from '@nestjs/common';
import type { GraphQLResolveInfo } from 'graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import {
  Args,
  Context,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import type {
  MutationCreateFleetVehicleArgs,
  MutationDeactivateFleetVehicleArgs,
  MutationDeleteFleetVehicleArgs,
  MutationUpdateFleetVehicleArgs,
  MutationDeleteFleetVehiclesArgs,
  MutationDeactivateFleetVehiclesArgs,
  FleetVehicle,
  QueryFleetVehicleArgs,
  QueryFleetVehiclesArgs,
  Branch,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { selectedReference, selects, type ReferenceBatches } from '../../graphql/selection.js';
import { VehiclesService, type VehicleResult } from './vehicles.service.js';

@Resolver('FleetVehicle')
@UseGuards(FleetEnabledGuard)
export class VehiclesResolver {
  private readonly referenceBatches: ReferenceBatches<VehicleResult> = new WeakMap();

  constructor(private readonly vehiclesService: VehiclesService) {}

  @Query('fleetVehicles')
  fleetVehicles(
    @Args() args: QueryFleetVehiclesArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.vehiclesService.list(
      context,
      args,
      selects(info, 'FleetVehiclePage', 'items', 'devices', 'state'),
    );
  }

  @Query('fleetVehicle')
  fleetVehicle(
    @Args() args: QueryFleetVehicleArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.vehiclesService.find(
      context,
      args.id,
      selects(info, 'FleetVehicle', 'devices', 'state'),
    );
  }

  @Query('fleetVehicleSummary')
  fleetVehicleSummary(@Context() context: RequestContext) {
    return this.vehiclesService.summary(context);
  }

  @Mutation('deleteFleetVehicles')
  deleteFleetVehicles(
    @Args() args: MutationDeleteFleetVehiclesArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.deleteMany(context, args.ids);
  }

  @Mutation('deactivateFleetVehicles')
  deactivateFleetVehicles(
    @Args() args: MutationDeactivateFleetVehiclesArgs,
    @Context() context: RequestContext,
  ) {
    return this.vehiclesService.deactivateMany(context, args.ids);
  }

  @Mutation('createFleetVehicle')
  createFleetVehicle(
    @Args() args: MutationCreateFleetVehicleArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.vehiclesService.create(
      context,
      args.input,
      selects(info, 'FleetVehicle', 'devices', 'state'),
    );
  }

  @Mutation('updateFleetVehicle')
  updateFleetVehicle(
    @Args() args: MutationUpdateFleetVehicleArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.vehiclesService.update(
      context,
      args.id,
      args.input,
      selects(info, 'FleetVehicle', 'devices', 'state'),
    );
  }

  @Mutation('deactivateFleetVehicle')
  deactivateFleetVehicle(
    @Args() args: MutationDeactivateFleetVehicleArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.vehiclesService.deactivate(
      context,
      args.id,
      selects(info, 'FleetVehicle', 'devices', 'state'),
    );
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
    @Info() info: GraphQLResolveInfo,
  ) {
    if (!selects(info, 'FleetVehicle', 'devices', 'state')) {
      return this.vehiclesService.find(context, reference.id);
    }
    return selectedReference(
      this.referenceBatches,
      context,
      info,
      'FleetVehicle',
      reference.id,
      (ids) => this.vehiclesService.references(context, ids),
      'Vehicle not found',
    );
  }

  @ResolveField('branch')
  branch(@Parent() vehicle: VehicleResult): Branch {
    return { __typename: 'Branch', id: vehicle.branchId };
  }
}
