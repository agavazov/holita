import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FleetClock } from '../../clock/fleet-clock.js';
import { DevicesService } from '../devices/devices.service.js';
import { faultFindings } from './fault-check.js';
import { FaultCheckRepository } from './fault-check.repository.js';

/** Replaces every vehicle's fault check from stored evidence; it sends nothing to vehicles. */
@Injectable()
export class FaultCheckJobs {
  private readonly logger = new Logger(FaultCheckJobs.name);

  constructor(
    private readonly checks: FaultCheckRepository,
    private readonly devices: DevicesService,
    private readonly clock: FleetClock,
  ) {}

  @Cron('0 */15 * * * *', { name: 'fault-check', waitForCompletion: true })
  async tick(): Promise<void> {
    if (process.env.FLEET_ENABLED === 'false') {
      return;
    }
    let scopes: Awaited<ReturnType<FaultCheckRepository['vehicleScopes']>>;
    try {
      scopes = await this.checks.vehicleScopes();
    } catch {
      this.logger.warn('Fault check could not read the vehicle registry.');
      return;
    }
    for (const { scope, vehicleIds } of scopes) {
      try {
        const now = this.clock.now();
        const [evidence, devices] = await Promise.all([
          this.checks.evidence(scope, vehicleIds, now),
          this.devices.forVehicles(scope, vehicleIds),
        ]);
        await this.checks.save(
          scope,
          now,
          vehicleIds.flatMap((vehicleId) => {
            const vehicle = evidence.get(vehicleId);
            return vehicle
              ? [
                  {
                    vehicleId,
                    dataAsOf: vehicle.dataAsOf,
                    findings: faultFindings(
                      devices
                        .filter((device) => device.vehicleId === vehicleId)
                        .flatMap((device) => device.currentWarnings),
                      vehicle,
                    ),
                  },
                ]
              : [];
          }),
        );
      } catch {
        this.logger.warn(`Fault check failed for Branch ${scope.branchId}; retrying later.`);
      }
    }
  }
}
