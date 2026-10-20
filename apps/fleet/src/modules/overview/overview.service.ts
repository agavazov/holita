import { Injectable, NotFoundException } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type { QueryFleetDailyDistanceArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { optionalInteger, requireScope, uuid } from '../../validation.js';
import { OverviewRepository } from './overview.repository.js';

@Injectable()
export class OverviewService {
  constructor(
    private readonly overviewRepository: OverviewRepository,
    private readonly clock: FleetClock,
  ) {}

  overview(context: RequestContext) {
    return this.overviewRepository.overview(requireScope(context), this.clock.now());
  }

  async dailyDistance(context: RequestContext, args: QueryFleetDailyDistanceArgs) {
    const scope = requireScope(context);
    const days = optionalInteger(args.days, 'days', 1, 93) ?? 14;
    const vehicleId = args.vehicleId == null ? undefined : uuid(args.vehicleId, 'vehicleId');
    if (vehicleId !== undefined && !(await this.overviewRepository.findVehicle(scope, vehicleId))) {
      throw new NotFoundException('Vehicle not found');
    }
    return this.overviewRepository.dailyDistance(scope, days, vehicleId);
  }
}
