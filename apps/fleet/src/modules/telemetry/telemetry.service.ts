import { Injectable, NotFoundException } from '@nestjs/common';
import { businessDate, FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetDataClock,
  FleetStatusSample,
  FleetStatusSampleSeries,
  FleetVehicleState,
  QueryFleetVehicleSamplesArgs,
  QueryFleetVehicleEdataMeasurementsArgs,
  FleetVehicleEdataMeasurementSeries,
  RecordFleetOdometerReadingInput,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import {
  dateTime,
  finite,
  integer,
  type FleetScope,
  invalid,
  requireScope,
  uuid,
} from '../../validation.js';
import {
  type OdometerReading,
  type SampleRow,
  TelemetryRepository,
} from './telemetry.repository.js';
import { classifyVehicleState, NO_FACTS } from './vehicle-state.js';
import { vehicleTrack } from './vehicle-track.js';
import { SettingsService } from '../settings/settings.service.js';

/** Most samples one series returns; the newest are kept. */
export const MAX_SERIES_SAMPLES = 2000;
const MAX_SERIES_DAYS = 7;
const DAY_MS = 86_400_000;
const VEHICLE_REQUIRED = 'Choose a vehicle in this branch that is not inactive.';

function requireAfterLatest(
  latest: OdometerReading | null,
  reading: { odometerKm: number; recordedAt: Date },
): void {
  if (latest?.odometerKm != null) {
    if (reading.recordedAt.getTime() <= latest.recordedAt.getTime()) {
      invalid(
        'recordedAt',
        'Use a time after the latest odometer reading of this vehicle.',
        'READING_NOT_LATER',
      );
    }
    if (reading.odometerKm < latest.odometerKm) {
      invalid(
        'odometerKm',
        'The odometer cannot be lower than the latest reading.',
        'ODOMETER_DECREASE',
      );
    }
  }
}

function toSample(row: SampleRow): FleetStatusSample {
  return row;
}

/** Key of a device's current (vehicle, IMEI) pair. */
export function reportingPair(vehicleId: string, imei: string): string {
  return `${vehicleId}:${imei}`;
}

@Injectable()
export class TelemetryService {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
    private readonly settings: SettingsService,
  ) {}

  async dataClock(context: RequestContext): Promise<FleetDataClock> {
    const scope = requireScope(context);
    const [asOf, settings] = await Promise.all([
      this.telemetry.asOf(scope),
      this.settings.read(scope),
    ]);
    return {
      asOf,
      businessDate: businessDate(this.clock.now(), settings.timeZone),
      timeZone: settings.timeZone,
    };
  }

  /** Samples of any source in `[from, to)`, at most seven days, ascending. */
  async samples(
    context: RequestContext,
    args: QueryFleetVehicleSamplesArgs,
  ): Promise<FleetStatusSampleSeries> {
    const scope = requireScope(context);
    const vehicleId = uuid(args.vehicleId, 'vehicleId');
    const from = dateTime(args.from, 'from');
    const to = dateTime(args.to, 'to');
    if (to.getTime() <= from.getTime()) {
      invalid('to', 'Use an end after the start.', 'INVALID_RANGE');
    }
    if (to.getTime() - from.getTime() > MAX_SERIES_DAYS * DAY_MS) {
      invalid('to', `Use a period of at most ${String(MAX_SERIES_DAYS)} days.`, 'OUT_OF_RANGE');
    }
    if (!(await this.telemetry.findVehicle(scope, vehicleId))) {
      throw new NotFoundException('Vehicle not found');
    }
    const [rows, asOf] = await Promise.all([
      this.telemetry.samples(scope, vehicleId, { from, to }, MAX_SERIES_SAMPLES + 1),
      this.telemetry.asOf(scope),
    ]);
    const items = rows.slice(0, MAX_SERIES_SAMPLES).reverse();
    const truncated = rows.length > MAX_SERIES_SAMPLES;
    return {
      vehicleId,
      from,
      to,
      items: items.map(toSample),
      truncated,
      track: vehicleTrack(items, { from, to }, truncated, asOf),
    };
  }

  async edataMeasurements(
    context: RequestContext,
    args: QueryFleetVehicleEdataMeasurementsArgs,
  ): Promise<FleetVehicleEdataMeasurementSeries> {
    const scope = requireScope(context);
    const vehicleId = uuid(args.vehicleId, 'vehicleId');
    const from = dateTime(args.from, 'from');
    const to = dateTime(args.to, 'to');
    if (to.getTime() <= from.getTime()) {
      invalid('to', 'Use an end after the start.', 'INVALID_RANGE');
    }
    if (to.getTime() - from.getTime() > MAX_SERIES_DAYS * DAY_MS) {
      invalid('to', `Use a period of at most ${String(MAX_SERIES_DAYS)} days.`, 'OUT_OF_RANGE');
    }
    if (
      args.parameterIds !== null &&
      args.parameterIds !== undefined &&
      args.parameterIds.length > 100
    ) {
      invalid('parameterIds', 'Choose at most 100 parameter IDs.', 'TOO_MANY_ITEMS');
    }
    const parameterIds =
      args.parameterIds == null
        ? undefined
        : [...new Set(args.parameterIds.map((value) => integer(value, 'parameterIds', 0, 65535)))];
    if (!(await this.telemetry.findVehicle(scope, vehicleId))) {
      throw new NotFoundException('Vehicle not found');
    }
    const rows = await this.telemetry.edataMeasurements(
      scope,
      vehicleId,
      { from, to },
      parameterIds,
      MAX_SERIES_SAMPLES + 1,
    );
    return {
      vehicleId,
      from,
      to,
      items: rows.slice(0, MAX_SERIES_SAMPLES).reverse(),
      truncated: rows.length > MAX_SERIES_SAMPLES,
    };
  }

  /**
   * Stores an operator odometer reading (source MANUAL). It never moves the data clock or the
   * vehicle activity. Readings of one vehicle are rechecked and stored one at a time under
   * its row lock; an overtaken reading receives the same validation error as a later request.
   */
  async recordOdometerReading(
    context: RequestContext,
    input: RecordFleetOdometerReadingInput,
  ): Promise<FleetStatusSample> {
    const scope = requireScope(context);
    const vehicleId = uuid(input.vehicleId, 'vehicleId');
    const odometerKm = Math.round(finite(input.odometerKm, 'odometerKm', 0, 9_999_999.9) * 10) / 10;
    const recordedAt = dateTime(input.recordedAt, 'recordedAt');
    const vehicle = await this.telemetry.findVehicle(scope, vehicleId);
    if (!vehicle || vehicle.status === 'INACTIVE') {
      invalid('vehicleId', VEHICLE_REQUIRED, 'VEHICLE_UNAVAILABLE');
    }
    const now = this.clock.now();
    const asOf = await this.telemetry.asOf(scope);
    const latestAllowed = asOf === null || asOf.getTime() > now.getTime() ? now : asOf;
    if (recordedAt.getTime() > latestAllowed.getTime()) {
      invalid(
        'recordedAt',
        'The reading cannot be later than the latest vehicle data or now.',
        'READING_AFTER_LATEST_DATA',
      );
    }
    const reading = { vehicleId, odometerKm, recordedAt, receivedAt: now };
    requireAfterLatest(await this.telemetry.latestOdometerReading(scope, vehicleId), reading);
    await this.core.requireBranch(scope.branchId, context);
    const stored = await this.telemetry.insertManualReading(scope, reading, (latest) => {
      requireAfterLatest(latest, reading);
    });
    if (stored === null) {
      invalid('vehicleId', VEHICLE_REQUIRED, 'VEHICLE_UNAVAILABLE');
    }
    return toSample(stored);
  }

  asOf(scope: FleetScope): Promise<Date | null> {
    return this.telemetry.asOf(scope);
  }

  /**
   * Latest state per vehicle ID (one clock query and one facts query for the whole page).
   * Vehicles without a row (deleted meanwhile) get `NO_FACTS`.
   */
  async vehicleStates(
    scope: FleetScope,
    ids: readonly string[],
  ): Promise<Map<string, FleetVehicleState>> {
    if (!ids.length) {
      return new Map();
    }
    const [asOf, facts, settings] = await Promise.all([
      this.telemetry.asOf(scope),
      this.telemetry.vehicleFacts(scope, ids),
      this.settings.read(scope),
    ]);
    const states = new Map(
      facts.map((item) => [item.vehicleId, classifyVehicleState(item, asOf, settings)] as const),
    );
    return new Map(
      ids.map((id) => [id, states.get(id) ?? classifyVehicleState(NO_FACTS, asOf, settings)]),
    );
  }

  /** `lastReportedAt` per current (vehicle, IMEI) pair, keyed by `reportingPair`. */
  async lastReported(
    scope: FleetScope,
    pairs: readonly { vehicleId: string; imei: string }[],
  ): Promise<Map<string, Date>> {
    const rows = await this.telemetry.lastReported(scope, pairs);
    return new Map(rows.map((row) => [reportingPair(row.vehicleId, row.imei), row.recordedAt]));
  }
}
