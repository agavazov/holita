import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationRequestFleetDeviceConfigurationReadArgs,
  MutationRequestFleetDeviceParameterAdditionArgs,
  MutationRequestFleetDeviceParameterIntervalUpdateArgs,
  QueryFleetDeviceOperationArgs,
  QueryFleetDeviceOperationsArgs,
  QueryFleetDeviceConfigurationSnapshotArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { DeviceOperationsService } from './device-operations.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class DeviceOperationsResolver {
  constructor(private readonly operations: DeviceOperationsService) {}

  @Query('fleetDeviceOperationsEnabled')
  enabled(@Context() context: RequestContext) {
    return this.operations.enabled(context);
  }

  @Query('fleetDeviceConfigurationWritesEnabled')
  writesEnabled(@Context() context: RequestContext) {
    return this.operations.writesEnabled(context);
  }

  @Query('fleetDeviceParameterPresets')
  presets(@Context() context: RequestContext) {
    return this.operations.presets(context);
  }

  @Mutation('requestFleetDeviceParameterAddition')
  requestAddition(
    @Args() args: MutationRequestFleetDeviceParameterAdditionArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.requestAddition(context, args.input);
  }

  @Mutation('requestFleetDeviceParameterIntervalUpdate')
  requestIntervalUpdate(
    @Args() args: MutationRequestFleetDeviceParameterIntervalUpdateArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.requestIntervalUpdate(context, args.input);
  }

  @Query('fleetDeviceOperation')
  find(@Args() args: QueryFleetDeviceOperationArgs, @Context() context: RequestContext) {
    return this.operations.find(context, args.id);
  }

  @Query('fleetDeviceOperations')
  history(@Args() args: QueryFleetDeviceOperationsArgs, @Context() context: RequestContext) {
    return this.operations.history(context, args.deviceId);
  }

  @Query('fleetDeviceConfigurationSnapshot')
  snapshot(
    @Args() args: QueryFleetDeviceConfigurationSnapshotArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.snapshot(context, args.deviceId);
  }

  @Mutation('requestFleetDeviceConfigurationRead')
  request(
    @Args() args: MutationRequestFleetDeviceConfigurationReadArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.request(context, args.input);
  }
}
