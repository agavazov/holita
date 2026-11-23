import { Injectable } from '@nestjs/common';
import { readHome, type BasicHome, type contentTarget } from './basic-home.js';
import { DatabaseService } from '../database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

const publicFields = {
  displayName: true,
  contactEmail: true,
  contactPhone: true,
  contactAddress: true,
  logoKey: true,
  faviconKey: true,
  basicHome: true,
} satisfies Prisma.ShopSettingsSelect;

type SettingsRow = Prisma.ShopSettingsGetPayload<{ select: typeof publicFields }>;
type BrandingKeys = Pick<SettingsRow, 'logoKey' | 'faviconKey'>;
type SettingsFields = Omit<SettingsRow, keyof BrandingKeys | 'basicHome'>;
type BrandingChange = { [Key in keyof BrandingKeys]: BrandingKeys[Key] | undefined };
export type StoredShopSettings = SettingsFields & BrandingKeys & { basicHome: BasicHome | null };

@Injectable()
export class ShopSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  find(scope: Scope) {
    return this.database.client.shopSettings.findUnique({
      where: { tenantId_branchId: scope },
      select: publicFields,
    });
  }

  save(
    scope: Scope,
    fields: SettingsFields,
    branding: BrandingChange,
    home?: (previous: BasicHome | null) => BasicHome,
  ) {
    return this.database.client.$transaction(async (tx) => {
      const where = { tenantId_branchId: scope };
      const row = await tx.shopSettings.upsert({
        where,
        create: { ...scope, ...fields },
        update: fields,
        select: publicFields,
      });
      const previous = readHome(row.basicHome);
      const basicHome = home ? home(previous) : previous;
      const logoKey = branding.logoKey === undefined ? row.logoKey : branding.logoKey;
      const faviconKey = branding.faviconKey === undefined ? row.faviconKey : branding.faviconKey;
      if ((home && basicHome) || logoKey !== row.logoKey || faviconKey !== row.faviconKey) {
        await tx.shopSettings.update({
          where,
          data: { logoKey, faviconKey, ...(home && basicHome && { basicHome }) },
        });
      }
      return {
        settings: { ...fields, logoKey, faviconKey, basicHome },
        previous,
        previousRow: row,
      };
    });
  }

  async destinationExists(
    scope: Scope,
    target: NonNullable<ReturnType<typeof contentTarget>>,
    publicOnly = false,
  ) {
    const where = { tenantId_branchId_slug: { ...scope, slug: target.slug } };
    const select = { id: true };
    const db = this.database.client;
    switch (target.section) {
      case 'categories':
        return !!(await db.category.findUnique({ where, select }));
      case 'collections':
        return !!(await db.productCollection.findUnique({
          where: { ...where, ...(publicOnly && { active: true }) },
          select,
        }));
      case 'pages':
        return !!(await db.shopPage.findUnique({
          where: { ...where, ...(publicOnly && { status: 'PUBLISHED' }) },
          select,
        }));
    }
  }
}
