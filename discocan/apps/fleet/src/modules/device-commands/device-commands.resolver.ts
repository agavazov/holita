import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  FleetDeviceCommandsArgs,
  MutationCancelDeviceCommandArgs,
  MutationRetryDeviceCommandArgs,
  MutationSendDeviceCommandArgs,
  MutationStartDeviceCommandBatchArgs,
  MutationStopDeviceCommandBatchArgs,
  QueryFleetDeviceActionCatalogArgs,
  QueryFleetDeviceCommandBatchArgs,
  QueryFleetDeviceCommandRequestArgs,
  QueryFleetDeviceCommandRequestsArgs,
  QueryFleetDeviceFaultReadsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { singleDeviceDetail } from '../../graphql/selection.js';
import type { DeviceResult } from '../devices/devices.service.js';
import { DeviceCommandsService } from './device-commands.service.js';

@Resolver('FleetDevice')
@UseGuards(FleetEnabledGuard)
export class DeviceCommandsResolver {
  constructor(private readonly deviceCommands: DeviceCommandsService) {}

  @Query('fleetDeviceCommandRequest')
  commandRequest(
    @Args() args: QueryFleetDeviceCommandRequestArgs,
    @Context() context: RequestContext,
  ) {
    return this.deviceCommands.get(context, args.id);
  }

  @Query('fleetDeviceCommandRequests')
  commandQueue(
    @Args() args: QueryFleetDeviceCommandRequestsArgs,
    @Context() context: RequestContext,
  ) {
    return this.deviceCommands.list(context, args);
  }

  @Query('fleetDeviceFaultReads')
  faultReadHistory(
    @Args() args: QueryFleetDeviceFaultReadsArgs,
    @Context() context: RequestContext,
  ) {
    return this.deviceCommands.faultReadHistory(context, args.deviceIds);
  }

  @Query('fleetDeviceCommandBatch')
  commandBatch(@Args() args: QueryFleetDeviceCommandBatchArgs, @Context() context: RequestContext) {
    return this.deviceCommands.batch(context, args.id);
  }

  @Query('fleetDeviceActionCatalog')
  actionCatalog(
    @Args() args: QueryFleetDeviceActionCatalogArgs,
    @Context() context: RequestContext,
  ) {
    return this.deviceCommands.catalog(context, args.deviceType);
  }

  @Mutation('sendDeviceCommand')
  sendCommand(@Args() args: MutationSendDeviceCommandArgs, @Context() context: RequestContext) {
    return this.deviceCommands.send(context, args.input);
  }

  @Mutation('cancelDeviceCommand')
  cancelCommand(@Args() args: MutationCancelDeviceCommandArgs, @Context() context: RequestContext) {
    return this.deviceCommands.cancel(context, args.input);
  }

  @Mutation('retryDeviceCommand')
  retryCommand(@Args() args: MutationRetryDeviceCommandArgs, @Context() context: RequestContext) {
    return this.deviceCommands.retry(context, args.input);
  }

  @Mutation('startDeviceCommandBatch')
  startCommandBatch(
    @Args() args: MutationStartDeviceCommandBatchArgs,
    @Context() context: RequestContext,
  ) {
    return this.deviceCommands.startBatch(context, args.input);
  }

  @Mutation('stopDeviceCommandBatch')
  stopCommandBatch(
    @Args() args: MutationStopDeviceCommandBatchArgs,
    @Context() context: RequestContext,
  ) {
    return this.deviceCommands.stopBatch(context, args.id);
  }

  @ResolveField('commandRequests')
  commandRequests(
    @Parent() device: DeviceResult,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    singleDeviceDetail(info);
    return this.deviceCommands.requestHistory(context, device);
  }

  @ResolveField('commands')
  commands(
    @Parent() device: DeviceResult,
    @Args() args: FleetDeviceCommandsArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    singleDeviceDetail(info);
    return this.deviceCommands.commands(context, device, args.input);
  }
}
