import { VehiclesService } from '../vehicles/vehicles.service.js';
import { UseGuards } from '@nestjs/common';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
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
  MutationCreateFleetDeviceArgs,
  MutationDeleteFleetDeviceArgs,
  MutationUpdateFleetDeviceArgs,
  FleetDevice,
  QueryFleetDeviceArgs,
  QueryFleetDevicesArgs,
  Branch,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { DevicesService, type DeviceResult } from './devices.service.js';

@Resolver('FleetDevice')
@UseGuards(FleetEnabledGuard)
export class DevicesResolver {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  @Query('fleetDevices')
  fleetDevices(@Args() args: QueryFleetDevicesArgs, @Context() context: RequestContext) {
    return this.devicesService.list(context, args);
  }

  @Query('fleetDevice')
  fleetDevice(@Args() args: QueryFleetDeviceArgs, @Context() context: RequestContext) {
    return this.devicesService.find(context, args.id);
  }

  @Mutation('createFleetDevice')
  createFleetDevice(
    @Args() args: MutationCreateFleetDeviceArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.create(context, args.input);
  }

  @Mutation('updateFleetDevice')
  updateFleetDevice(
    @Args() args: MutationUpdateFleetDeviceArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.update(context, args.id, args.input);
  }

  @Mutation('deleteFleetDevice')
  deleteFleetDevice(
    @Args() args: MutationDeleteFleetDeviceArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<FleetDevice, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.find(context, reference.id);
  }

  @ResolveField('vehicle')
  vehicle(@Parent() device: DeviceResult, @Context() context: RequestContext) {
    return this.vehiclesService.find(context, device.vehicleId);
  }

  @ResolveField('branch')
  branch(@Parent() device: DeviceResult): Branch {
    return { __typename: 'Branch', id: device.branchId };
  }
}
