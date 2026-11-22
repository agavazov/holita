# 154 Translate demo catalogue labels and repair demo SKU references

**Status:** Ready. **Product:** Holita.

## Background

The fresh Bulgarian demo includes English characteristic labels and values and an English collection name. Existing demo shops can also retain LEGACY-* SKUs and backfilled variant IDs from the variant migration. The cart and order fixtures expect configured SKUs or deterministic variant IDs.

## Goal

Make fresh demo labels Bulgarian and let an upgraded demo load its cart and fixture orders.

## Steps

1. Translate the Bulgarian demo characteristic labels, values and the manual collection name in the fixtures. Preserve IDs and slugs and keep seeding insert-only.
2. Use the stable demo Tenant, Branch and fixture identities to repair only broken SKU or variant references. Keep the existing sellable variant identity and existing order links. Leave edited rows alone and report conflicts.

## Done when

A fresh seed shows Bulgarian labels. An upgraded demo resolves the broken fixture references and loads its cart and fixture orders. A second run makes no further repairs.

## Limits

Demo data only. Leave saved characteristic and collection rows as they are. Keep applied migrations, merchant data, historical order snapshots and database volumes intact.

## References

- [Demo catalogue](../../holita/tools/demo-catalogue.mts)
- [Demo variant lookup](../../holita/tools/holita-seed.mts#L463)
- [Variant backfill](../../holita/apps/commerce/prisma/migrations/20261122020000_product_variants/migration.sql)
