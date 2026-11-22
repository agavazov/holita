import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

const publicFields = {
  displayName: true,
  contactEmail: true,
  contactPhone: true,
  contactAddress: true,
} satisfies Prisma.ShopSettingsSelect;

type SettingsFields = Prisma.ShopSettingsGetPayload<{ select: typeof publicFields }>;

@Injectable()
export class ShopSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  find(scope: Scope) {
    return this.database.client.shopSettings.findUnique({
      where: { tenantId_branchId: scope },
      select: publicFields,
    });
  }

  save(scope: Scope, fields: SettingsFields) {
    return this.database.client.shopSettings.upsert({
      where: { tenantId_branchId: scope },
      create: { ...scope, ...fields },
      update: fields,
      select: publicFields,
    });
  }
}
