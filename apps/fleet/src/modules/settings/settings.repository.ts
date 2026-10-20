import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { UpdateFleetSettingsInput } from '../../generated/graphql/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';

const settingsSelect = {
  timeZone: true,
  distanceUnit: true,
  volumeUnit: true,
  lowFuelPct: true,
  notReportingHours: true,
  speedLimitKph: true,
} satisfies Prisma.FleetSettingsSelect;

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  read(scope: FleetScope) {
    return this.prisma.client.fleetSettings.findUnique({
      where: { tenantId_branchId: scope },
      select: settingsSelect,
    });
  }

  replace(scope: FleetScope, data: UpdateFleetSettingsInput) {
    return this.prisma.client.fleetSettings.upsert({
      where: { tenantId_branchId: scope },
      create: { ...scope, ...data },
      update: data,
      select: settingsSelect,
    });
  }
}
