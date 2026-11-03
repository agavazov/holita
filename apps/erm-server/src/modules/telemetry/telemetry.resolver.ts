import {
  Args,
  Context,
  Info,
  Mutation,
  Parent,
  ResolveField,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import type {
  MutationSendErmDeviceCommandArgs,
  FleetDevice,
  FleetDeviceErmEventsArgs,
  FleetDeviceErmFramesArgs,
  FleetDeviceErmCommandsArgs,
  ErmEventNameArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { TelemetryService, type DeviceReference } from './telemetry.service.js';
import { starlinkEvents } from '../../starlink/event-catalog.js';

@Resolver()
export class TelemetryResolver {
  constructor(private readonly telemetry: TelemetryService) {}

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
  constructor(private readonly telemetry: TelemetryService) {}

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
}

@Resolver('ErmEvent')
export class ErmEventResolver {
  @ResolveField('name')
  name(@Parent() event: { eventId: string | null }, @Args() args: ErmEventNameArgs) {
    const entry = starlinkEvents.get(event.eventId ?? '');
    return (args.language === 'BG' ? entry?.bg : entry?.en) ?? null;
  }
}
