import { Injectable } from '@nestjs/common';
import type { FleetSettings, UpdateFleetSettingsInput } from '../../generated/graphql/types.js';
import { FleetDistanceUnit, FleetVolumeUnit } from '../../generated/prisma/enums.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { enumValue, integer, requireScope, type FleetScope } from '../../validation.js';
import { defaultFleetSettings, FLEET_TIME_ZONES } from './settings-defaults.js';
import { SettingsRepository } from './settings.repository.js';

@Injectable()
export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly core: CoreClient,
  ) {}

  async read(scope: FleetScope): Promise<FleetSettings> {
    return (await this.settings.read(scope)) ?? defaultFleetSettings();
  }

  find(context: RequestContext): Promise<FleetSettings> {
    return this.read(requireScope(context));
  }

  async update(context: RequestContext, input: UpdateFleetSettingsInput): Promise<FleetSettings> {
    const scope = requireScope(context);
    const data: UpdateFleetSettingsInput = {
      timeZone: enumValue(input.timeZone, FLEET_TIME_ZONES, 'timeZone'),
      distanceUnit: enumValue(input.distanceUnit, Object.values(FleetDistanceUnit), 'distanceUnit'),
      volumeUnit: enumValue(input.volumeUnit, Object.values(FleetVolumeUnit), 'volumeUnit'),
      lowFuelPct: integer(input.lowFuelPct, 'lowFuelPct', 1, 50),
      notReportingHours: integer(input.notReportingHours, 'notReportingHours', 1, 168),
      speedLimitKph: integer(input.speedLimitKph, 'speedLimitKph', 30, 130),
    };
    await this.core.requireBranch(scope.branchId, context);
    return this.settings.replace(scope, data);
  }
}
