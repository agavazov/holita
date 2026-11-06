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
import type {
  MutationSendErmDeviceCommandArgs,
  QueryErmCommandRequestsArgs,
  QueryErmCommandBatchArgs,
  MutationRetryErmDeviceCommandArgs,
  MutationStartErmCommandBatchArgs,
  MutationStopErmCommandBatchArgs,
  QueryErmCommandRequestArgs,
  QueryErmFleetTelemetryArgs,
  QueryErmFleetProblemsArgs,
  FleetDevice,
  FleetDeviceErmEventsArgs,
  FleetDeviceErmFramesArgs,
  FleetDeviceErmCommandsArgs,
  ErmEventNameArgs,
  MutationStartErmParameterSnapshotArgs,
  FleetDeviceErmParameterSnapshotsArgs,
  MutationStartErmEdataChangeArgs,
  MutationStartErmParameterChangeArgs,
  MutationCancelErmDeviceCommandArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { TelemetryService, type DeviceReference } from './telemetry.service.js';
import { eventName } from '../../starlink/event-catalog.js';
import { ParameterSnapshotsService } from './parameter-snapshots.service.js';
import { ConfigurationChangesService } from './configuration-changes.service.js';
import { CommandRequestsService } from './command-requests.service.js';

@Resolver()
export class TelemetryResolver {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly snapshots: ParameterSnapshotsService,
    private readonly configurations: ConfigurationChangesService,
    private readonly commandRequests: CommandRequestsService,
  ) {}

  @Query('ermFleetTelemetry')
  fleetTelemetry(@Args() args: QueryErmFleetTelemetryArgs, @Context() context: RequestContext) {
    return this.telemetry.fleetTelemetry(args.imeis, context);
  }

  @Query('ermFleetProblems')
  fleetProblems(@Args() args: QueryErmFleetProblemsArgs, @Context() context: RequestContext) {
    return this.telemetry.fleetProblems(args, context);
  }

  @Query('ermCommandRequest')
  commandRequest(@Args() args: QueryErmCommandRequestArgs, @Context() context: RequestContext) {
    return this.commandRequests.find(args.id, context);
  }

  @Query('ermCommandRequests')
  branchCommandRequests(
    @Args() args: QueryErmCommandRequestsArgs,
    @Context() context: RequestContext,
  ) {
    return this.commandRequests.list(args, context);
  }

  @Query('ermCommandBatch')
  commandBatch(@Args() args: QueryErmCommandBatchArgs, @Context() context: RequestContext) {
    return this.commandRequests.batch(args.id, context);
  }

  @Mutation('retryErmDeviceCommand')
  retryDeviceCommand(
    @Args() args: MutationRetryErmDeviceCommandArgs,
    @Context() context: RequestContext,
  ) {
    return this.commandRequests.retry(args.input, context);
  }

  @Mutation('startErmCommandBatch')
  startCommandBatch(
    @Args() args: MutationStartErmCommandBatchArgs,
    @Context() context: RequestContext,
  ) {
    return this.commandRequests.startBatch(args.input, context);
  }

  @Mutation('stopErmCommandBatch')
  stopCommandBatch(
    @Args() args: MutationStopErmCommandBatchArgs,
    @Context() context: RequestContext,
  ) {
    return this.commandRequests.stopBatch(args.id, context);
  }

  @Mutation('cancelErmDeviceCommand')
  cancelDeviceCommand(
    @Args() args: MutationCancelErmDeviceCommandArgs,
    @Context() context: RequestContext,
  ) {
    return this.commandRequests.cancel(args.input, context);
  }

  @Mutation('startErmEdataChange')
  startEdataChange(
    @Args() args: MutationStartErmEdataChangeArgs,
    @Context() context: RequestContext,
  ) {
    return this.configurations.startEdata(args.input, context);
  }

  @Mutation('startErmParameterChange')
  startParameterChange(
    @Args() args: MutationStartErmParameterChangeArgs,
    @Context() context: RequestContext,
  ) {
    return this.configurations.startParameter(args.input, context);
  }

  @Mutation('startErmParameterSnapshot')
  startParameterSnapshot(
    @Args() args: MutationStartErmParameterSnapshotArgs,
    @Context() context: RequestContext,
  ) {
    return this.snapshots.start(args.input.deviceId, context);
  }

  @Mutation('sendErmDeviceCommand')
  sendDeviceCommand(
    @Args() args: MutationSendErmDeviceCommandArgs,
    @Context() context: RequestContext,
  ) {
    return this.telemetry.sendDeviceCommand(args.input, context);
  }
}

@Resolver('FleetDevice')
export class ErmDeviceResolver {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly snapshots: ParameterSnapshotsService,
    private readonly configurations: ConfigurationChangesService,
    private readonly commandRequests: CommandRequestsService,
  ) {}

  @ResolveField('ermCommandRequests')
  commandRequestsHistory(@Parent() device: DeviceReference, @Context() context: RequestContext) {
    return this.commandRequests.deviceRequests(device, context);
  }

  @ResolveField('ermConfigurationChanges')
  configurationChanges(@Parent() device: DeviceReference, @Context() context: RequestContext) {
    return this.configurations.deviceChanges(device, context);
  }

  @ResolveField('ermConfigurationWritesEnabled')
  configurationWritesEnabled(@Context() context: RequestContext) {
    return this.configurations.writesEnabled(context);
  }

  @ResolveReference()
  reference(
    @Parent() reference: Pick<FleetDevice, 'id' | 'imei'>,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return this.telemetry.reference(reference, context, info);
  }

  @ResolveField('ermState')
  state(@Parent() device: DeviceReference, @Context() context: RequestContext) {
    return this.telemetry.deviceState(device, context);
  }

  @ResolveField('ermEvents')
  events(
    @Parent() device: DeviceReference,
    @Args() args: FleetDeviceErmEventsArgs,
    @Context() context: RequestContext,
  ) {
    return this.telemetry.deviceEvents(device, args.input, context);
  }

  @ResolveField('ermFrames')
  frames(
    @Parent() device: DeviceReference,
    @Args() args: FleetDeviceErmFramesArgs,
    @Context() context: RequestContext,
  ) {
    return this.telemetry.deviceFrames(device, args.input, context);
  }

  @ResolveField('ermCommands')
  commands(
    @Parent() device: DeviceReference,
    @Args() args: FleetDeviceErmCommandsArgs,
    @Context() context: RequestContext,
  ) {
    return this.telemetry.deviceCommands(device, args.input, context);
  }

  @ResolveField('ermParameterSnapshots')
  parameterSnapshots(
    @Parent() device: DeviceReference,
    @Args() args: FleetDeviceErmParameterSnapshotsArgs,
    @Context() context: RequestContext,
  ) {
    return this.snapshots.deviceSnapshots(device, args.input, context);
  }
}

@Resolver('ErmEvent')
export class ErmEventResolver {
  @ResolveField('name')
  name(
    @Parent() event: { eventId: string | null; fields?: unknown },
    @Args() args: ErmEventNameArgs,
  ) {
    return eventName(event.eventId, event.fields, args.language ?? 'EN');
  }
}
