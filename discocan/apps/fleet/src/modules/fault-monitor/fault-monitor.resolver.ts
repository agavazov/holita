import { UseGuards } from '@nestjs/common';
import { Args, Context, Info, Query, Resolver } from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetFaultLogArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { selects } from '../../graphql/selection.js';
import { FaultMonitorService } from './fault-monitor.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class FaultMonitorResolver {
  constructor(private readonly monitor: FaultMonitorService) {}

  @Query('fleetFaultMonitor')
  fleetFaultMonitor(@Context() context: RequestContext, @Info() info: GraphQLResolveInfo) {
    return this.monitor.vehicles(
      context,
      selects(info, 'FleetFaultMonitorVehicle', 'devices', 'state'),
    );
  }

  @Query('fleetFaultLog')
  fleetFaultLog(@Args() args: QueryFleetFaultLogArgs, @Context() context: RequestContext) {
    return this.monitor.log(context, args);
  }
}
