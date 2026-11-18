import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { QueryFleetFaultLogArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { FaultMonitorService } from './fault-monitor.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class FaultMonitorResolver {
  constructor(private readonly monitor: FaultMonitorService) {}

  @Query('fleetFaultMonitor')
  fleetFaultMonitor(@Context() context: RequestContext) {
    return this.monitor.vehicles(context);
  }

  @Query('fleetFaultLog')
  fleetFaultLog(@Args() args: QueryFleetFaultLogArgs, @Context() context: RequestContext) {
    return this.monitor.log(context, args);
  }
}
