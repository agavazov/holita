import { UseGuards } from '@nestjs/common';
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
import type { GraphQLResolveInfo } from 'graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { hasRole } from '../../auth/roles.js';
import type {
  Branch,
  FleetDevice,
  MutationCreateFleetDeviceArgs,
  MutationDeleteFleetDeviceArgs,
  MutationDeleteFleetDevicesArgs,
  MutationUpdateFleetDeviceArgs,
  QueryFleetDeviceArgs,
  QueryFleetDevicesArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { selectedReference, selects, type ReferenceBatches } from '../../graphql/selection.js';
import { DevicesService, type DeviceResult } from './devices.service.js';

@Resolver('FleetDevice')
@UseGuards(FleetEnabledGuard)
export class DevicesResolver {
  private readonly referenceBatches = new WeakMap() satisfies ReferenceBatches<DeviceResult>;

  constructor(private readonly devicesService: DevicesService) {}

  @Query('fleetDevices')
  fleetDevices(
    @Args() args: QueryFleetDevicesArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.devicesService.list(
      context,
      args,
      selects(info, 'FleetDevicePage', 'items', 'state'),
    );
  }

  @Query('fleetDevice')
  fleetDevice(
    @Args() args: QueryFleetDeviceArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.devicesService.find(context, args.id, selects(info, 'FleetDevice', 'state'));
  }

  @Query('fleetDeviceSummary')
  fleetDeviceSummary(@Context() context: RequestContext) {
    return this.devicesService.summary(context);
  }

  @Mutation('createFleetDevice')
  createFleetDevice(
    @Args() args: MutationCreateFleetDeviceArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.devicesService.create(context, args.input, selects(info, 'FleetDevice', 'state'));
  }

  @Mutation('updateFleetDevice')
  updateFleetDevice(
    @Args() args: MutationUpdateFleetDeviceArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.devicesService.update(
      context,
      args.id,
      args.input,
      selects(info, 'FleetDevice', 'state'),
    );
  }

  @Mutation('deleteFleetDevice')
  deleteFleetDevice(
    @Args() args: MutationDeleteFleetDeviceArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.delete(context, args.id);
  }

  @Mutation('deleteFleetDevices')
  deleteFleetDevices(
    @Args() args: MutationDeleteFleetDevicesArgs,
    @Context() context: RequestContext,
  ) {
    return this.devicesService.deleteMany(context, args.ids);
  }

  @ResolveReference()
  async resolveReference(
    @Parent() reference: Pick<FleetDevice, 'id'>,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    if (!selects(info, 'FleetDevice', 'state')) {
      return this.devicesService.find(context, reference.id);
    }
    return selectedReference(
      this.referenceBatches,
      context,
      info,
      'FleetDevice',
      reference.id,
      (ids) => this.devicesService.references(context, ids),
      'Device not found',
    );
  }

  @ResolveField('branch')
  branch(@Parent() device: DeviceResult): Branch {
    return { __typename: 'Branch', id: device.branchId };
  }

  @ResolveField('smsPassword')
  async smsPassword(@Parent() device: DeviceResult, @Context() context: RequestContext) {
    return (await hasRole(context, 'OPERATOR')) ? device.smsPassword : null;
  }
}
