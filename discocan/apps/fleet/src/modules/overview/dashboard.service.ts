import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetDashboard,
  FleetMapDeviceStatus,
  FleetMapPage,
  QueryFleetDashboardArgs,
  QueryFleetMapArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  ErmDashboardClient,
  type ErmDashboardTelemetry,
} from '../../integrations/erm/erm-dashboard.client.js';
import { dateTime, invalid, pagination, requireScope } from '../../validation.js';
import { ProblemsService } from '../events/problems.service.js';
import { DashboardRepository } from './dashboard.repository.js';

function deviceStatuses(
  devices: { id: string; imei: string; vehicleId: string | null }[],
  telemetry: ErmDashboardTelemetry,
) {
  const byImei = new Map(telemetry.units.map((unit) => [unit.imei, unit]));
  return devices.map((device) => {
    const state = byImei.get(device.imei);
    if (!state) {
      throw new ServiceUnavailableException('Incomplete ERM dashboard snapshot');
    }
    return {
      ...state,
      deviceId: device.id,
      vehicleId: device.vehicleId,
      live: state.connected && state.reporting,
    };
  });
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly erm: ErmDashboardClient,
    private readonly problems: ProblemsService,
    private readonly clock: FleetClock,
  ) {}

  async dashboard(context: RequestContext, args: QueryFleetDashboardArgs): Promise<FleetDashboard> {
    const scope = requireScope(context);
    const from = dateTime(args.from, 'from'),
      to = dateTime(args.to, 'to');
    if (to <= from || to.getTime() - from.getTime() > 93 * 86_400_000) {
      invalid('to', 'Use a period after from and no longer than 93 days.', 'INVALID_RANGE');
    }
    const asOf = this.clock.now();
    const snapshot = await this.repository.dashboard(scope, { from, to });
    const telemetry = await this.erm.telemetry(snapshot.devices.map((device) => device.imei));
    const states = deviceStatuses(snapshot.devices, telemetry);
    const vehicles = (field: 'connected' | 'reporting' | 'live') =>
      new Set(
        states
          .filter((state) => state.vehicleId !== null && state[field])
          .map((state) => state.vehicleId),
      ).size;
    return {
      vehicles: {
        asOf,
        dataAsOf: snapshot.dataAsOf,
        liveAsOf: telemetry.asOf,
        total: snapshot.total,
        connected: vehicles('connected'),
        reporting: vehicles('reporting'),
        live: vehicles('live'),
        moving: snapshot.moving,
        idle: snapshot.idle,
        parked: snapshot.parked,
        notReporting: snapshot.notReporting,
        asset: snapshot.asset,
        noDevice: snapshot.noDevice,
      },
      devices: {
        asOf,
        liveAsOf: telemetry.asOf,
        total: states.length,
        connected: states.filter((state) => state.connected).length,
        reporting: states.filter((state) => state.reporting).length,
        live: states.filter((state) => state.live).length,
      },
      trips: {
        asOf,
        dataAsOf: snapshot.dataAsOf,
        from,
        to,
        total: snapshot.tripCount,
        distanceKm: snapshot.tripCount === 0 ? 0 : snapshot.distanceKm,
        distanceKnownTrips: snapshot.distanceKnownTrips,
      },
      problems: await this.problems.summary(context, { from, to }, telemetry),
    };
  }

  async map(context: RequestContext, args: QueryFleetMapArgs): Promise<FleetMapPage> {
    const scope = requireScope(context),
      page = pagination(args),
      asOf = this.clock.now();
    const snapshot = await this.repository.map(scope, page, asOf);
    const telemetry = await this.erm.telemetry(snapshot.devices.map((device) => device.imei));
    const states = deviceStatuses(snapshot.devices, telemetry);
    const byVehicle = new Map<string, FleetMapDeviceStatus[]>();
    for (const state of states) {
      if (state.vehicleId === null) {
        continue;
      }
      const devices = byVehicle.get(state.vehicleId) ?? [];
      devices.push(state);
      byVehicle.set(state.vehicleId, devices);
    }
    return {
      ...page,
      asOf,
      liveAsOf: telemetry.asOf,
      dataAsOf: snapshot.dataAsOf,
      total: snapshot.total,
      withPosition: snapshot.withPosition,
      withoutPosition: snapshot.total - snapshot.withPosition,
      hasMore: page.offset + snapshot.items.length < snapshot.total,
      items: snapshot.items.map((item) => {
        const devices = byVehicle.get(item.vehicle.id) ?? [];
        return {
          ...item,
          devices,
          connected: devices.some((device) => device.connected),
          reporting: devices.some((device) => device.reporting),
          live: devices.some((device) => device.live),
        };
      }),
    };
  }
}
