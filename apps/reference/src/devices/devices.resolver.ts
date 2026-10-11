import { VehiclesService } from '../vehicles/vehicles.service.js';
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
  MutationCreateReferenceDeviceArgs,
  MutationDeleteReferenceDeviceArgs,
  MutationUpdateReferenceDeviceArgs,
  ReferenceDevice,
  QueryReferenceDeviceArgs,
  QueryReferenceDevicesArgs,
  Store,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { DevicesService, type DeviceResult } from './devices.service.js';

@Resolver('ReferenceDevice')
@UseGuards(ReferenceEnabledGuard)
export class DevicesResolver {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  @Query('referenceDevices')
  referenceDevices(@Args() args: QueryReferenceDevicesArgs, @Context() context: RequestContext) {
    return this.devicesService.list(context, args);
  }

  @Query('referenceDevice')
  referenceDevice(@Args() args: QueryReferenceDeviceArgs, @Context() context: RequestContext) {
    return this.devicesService.find(context, args.id);
  }

  @Mutation('createReferenceDevice')
  createReferenceDevice(
    @Args() args: MutationCreateReferenceDeviceArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.create(context, args.input);
  }

  @Mutation('updateReferenceDevice')
  updateReferenceDevice(
    @Args() args: MutationUpdateReferenceDeviceArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.update(context, args.id, args.input);
  }

  @Mutation('deleteReferenceDevice')
  deleteReferenceDevice(
    @Args() args: MutationDeleteReferenceDeviceArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<ReferenceDevice, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.find(context, reference.id);
  }

  @ResolveField('vehicle')
  vehicle(@Parent() device: DeviceResult, @Context() context: RequestContext) {
    return this.vehiclesService.find(context, device.vehicleId);
  }

  @ResolveField('store')
  store(@Parent() device: DeviceResult): Store {
    return { __typename: 'Store', id: device.storeId };
  }
}
