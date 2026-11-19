import { ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Args, Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  FleetDeviceEventNameArgs,
  FleetDeviceEventsArgs,
  FleetDeviceMessagesArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { InspectionEvent } from '../../integrations/device-adapter.js';
import type { DeviceResult } from '../devices/devices.service.js';
import { DeviceInspectionService } from './device-inspection.service.js';

@Resolver('FleetDevice')
@UseGuards(FleetEnabledGuard)
export class DeviceInspectionResolver {
  constructor(private readonly inspection: DeviceInspectionService) {}

  @ResolveField('state')
  state(@Parent() device: DeviceResult) {
    if (device.state instanceof ServiceUnavailableException) {
      throw device.state;
    }
    return device.state ?? null;
  }

  @ResolveField('events')
  events(
    @Parent() device: DeviceResult,
    @Args() args: FleetDeviceEventsArgs,
    @Context() context: RequestContext,
  ) {
    return this.inspection.events(context, device.id, args.input);
  }

  @ResolveField('messages')
  messages(
    @Parent() device: DeviceResult,
    @Args() args: FleetDeviceMessagesArgs,
    @Context() context: RequestContext,
  ) {
    return this.inspection.messages(context, device.id, args.input);
  }
}

@Resolver('FleetDeviceEvent')
export class DeviceEventResolver {
  @ResolveField('name')
  name(@Parent() event: InspectionEvent, @Args() args: FleetDeviceEventNameArgs) {
    return event.names[args.language ?? 'EN'];
  }
}
