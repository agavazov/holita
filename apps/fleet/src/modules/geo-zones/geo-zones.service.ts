import { Injectable } from '@nestjs/common';
import type {
  FleetGeoZone,
  FleetGeoZoneEventKind,
  FleetGeoZoneEventPage,
  QueryFleetGeoZoneEventsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  enumValue,
  ids,
  invalid,
  optionalDateTime,
  pagination,
  requireScope,
} from '../../validation.js';
import { GeoZonesRepository } from './geo-zones.repository.js';

const KINDS: readonly FleetGeoZoneEventKind[] = ['ENTER', 'EXIT'];

@Injectable()
export class GeoZonesService {
  constructor(private readonly geoZones: GeoZonesRepository) {}

  async zones(context: RequestContext): Promise<FleetGeoZone[]> {
    const zones = await this.geoZones.zones(requireScope(context));
    return zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      points: zone.ring.map(([longitude, latitude]) => ({ latitude, longitude })),
    }));
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
