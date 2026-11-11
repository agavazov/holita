import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FleetClock } from '../../clock/fleet-clock.js';
import { zoneTransitions } from './geo-zone-geometry.js';
import { GeoZonesRepository } from './geo-zones.repository.js';

const BATCH = 5000;
const BACKFILL_MS = 7 * 24 * 3_600_000;

/** Logs zone entries and exits from imported positions; the first run backfills seven days. */
@Injectable()
export class GeoZonesJobs {
  private readonly logger = new Logger(GeoZonesJobs.name);

  constructor(
    private readonly geoZones: GeoZonesRepository,
    private readonly clock: FleetClock,
  ) {}

  @Cron('15 * * * * *', { name: 'geo-zone-events', waitForCompletion: true })
  async tick(): Promise<void> {
    if (process.env.FLEET_ENABLED === 'false') {
      return;
    }
    let scopes: Awaited<ReturnType<GeoZonesRepository['zoneScopes']>>;
    try {
      scopes = await this.geoZones.zoneScopes();
    } catch {
      this.logger.warn('Geo zones could not be read.');
      return;
    }
    for (const scope of scopes) {
      try {
        const zones = await this.geoZones.zones(scope);
        const since = new Date(this.clock.now().getTime() - BACKFILL_MS);
        let cursor = await this.geoZones.cursor(scope);
        for (;;) {
          const samples = await this.geoZones.samples(scope, cursor, since, BATCH);
          const last = samples.at(-1);
          if (!last) {
            break;
          }
          const vehicleIds = [...new Set(samples.map((sample) => sample.vehicleId))];
          const state = await this.geoZones.states(scope, vehicleIds);
          cursor = { sampleCreatedAt: last.createdAt, sampleId: last.id };
          const created = await this.geoZones.save(
            scope,
            zoneTransitions(zones, samples, state),
            cursor,
          );
          if (created > 0) {
            this.logger.log(
              `Logged ${String(created)} geo-zone events for Branch ${scope.branchId}.`,
            );
          }
          if (samples.length < BATCH) {
            break;
          }
        }
      } catch {
        this.logger.warn(`Geo-zone events failed for Branch ${scope.branchId}; retrying later.`);
      }
    }
  }
}
