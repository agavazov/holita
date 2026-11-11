import { Injectable } from '@nestjs/common';
import { requireRole } from '../../auth/roles.js';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetGeoZone,
  FleetGeoZoneEventKind,
  FleetGeoZoneEventPage,
  FleetGeoZoneInput,
  QueryFleetGeoZoneEventsArgs,
} from '../../generated/graphql/types.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  enumValue,
  ids,
  invalid,
  optionalDateTime,
  pagination,
  persistenceError,
  requireScope,
  rethrowUniqueViolation,
  text,
  uuid,
  type FieldError,
} from '../../validation.js';
import { closedRing, ringProblem, type Ring } from './geo-zone-geometry.js';
import { type GeoZoneRecord, GeoZonesRepository } from './geo-zones.repository.js';

const KINDS: readonly FleetGeoZoneEventKind[] = ['ENTER', 'EXIT'];
const DUPLICATE_NAME: FieldError = {
  path: 'name',
  message: 'A geo zone with this name already exists in this branch.',
  code: 'ALREADY_EXISTS',
};
const UNIQUE_INDEXES = new Map([['geoZone_activeName_key', DUPLICATE_NAME]]);

function toZone(zone: GeoZoneRecord): FleetGeoZone {
  return {
    id: zone.id,
    name: zone.name,
    points: zone.ring.map(([longitude, latitude]) => ({ latitude, longitude })),
  };
}

function zoneInput(input: FleetGeoZoneInput): { name: string; ring: Ring } {
  const name = text(input.name, 'name', 120);
  const problem = Array.isArray(input.points)
    ? ringProblem(input.points)
    : { code: 'INVALID_TYPE' as const, message: 'Provide the zone vertices.' };
  if (problem) {
    invalid('points', problem.message, problem.code);
  }
  return { name, ring: closedRing(input.points) };
}

@Injectable()
export class GeoZonesService {
  constructor(
    private readonly geoZones: GeoZonesRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
  ) {}

  async zones(context: RequestContext): Promise<FleetGeoZone[]> {
    return (await this.geoZones.zones(requireScope(context))).map(toZone);
  }

  async create(context: RequestContext, input: FleetGeoZoneInput): Promise<FleetGeoZone> {
    const scope = requireScope(context);
    await requireRole(context, 'OPERATOR');
    const { name, ring } = zoneInput(input);
    await this.core.requireBranch(scope.branchId, context);
    try {
      return toZone(await this.geoZones.create(scope, name, ring));
    } catch (error) {
      rethrowUniqueViolation(error, UNIQUE_INDEXES);
      throw error;
    }
  }

  async update(
    context: RequestContext,
    id: string,
    input: FleetGeoZoneInput,
  ): Promise<FleetGeoZone> {
    const scope = requireScope(context);
    await requireRole(context, 'OPERATOR');
    const recordId = uuid(id, 'id');
    const { name, ring } = zoneInput(input);
    try {
      return toZone(await this.geoZones.update(scope, recordId, name, ring));
    } catch (error) {
      rethrowUniqueViolation(error, UNIQUE_INDEXES);
      persistenceError(error, 'Geo zone');
    }
  }

  async delete(context: RequestContext, id: string): Promise<FleetGeoZone> {
    const scope = requireScope(context);
    await requireRole(context, 'OPERATOR');
    const recordId = uuid(id, 'id');
    try {
      return toZone(await this.geoZones.delete(scope, recordId, this.clock.now()));
    } catch (error) {
      persistenceError(error, 'Geo zone');
    }
  }

  async events(
    context: RequestContext,
    args: QueryFleetGeoZoneEventsArgs,
  ): Promise<FleetGeoZoneEventPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const filter = args.filter ?? {};
    const occurredFrom = optionalDateTime(filter.occurredFrom, 'filter');
    const occurredTo = optionalDateTime(filter.occurredTo, 'filter');
    if (occurredFrom && occurredTo && occurredFrom > occurredTo) {
      invalid('filter', 'occurredFrom must not be after occurredTo.', 'INVALID_RANGE');
    }
    const { items, total } = await this.geoZones.events(scope, {
      vehicleIds: filter.vehicleIds == null ? null : ids(filter.vehicleIds, 'filter'),
      zoneIds: filter.zoneIds == null ? null : ids(filter.zoneIds, 'filter'),
      kinds:
        filter.kinds == null ? null : filter.kinds.map((kind) => enumValue(kind, KINDS, 'filter')),
      occurredFrom,
      occurredTo,
      offset,
      limit,
    });
    return {
      items: items.map((event) => ({
        id: event.id,
        kind: event.kind,
        occurredAt: event.occurredAt,
        latitude: event.latitude,
        longitude: event.longitude,
        zone: event.zone,
        vehicle: event.vehicle,
      })),
      total,
      offset,
      limit,
    };
  }
}
