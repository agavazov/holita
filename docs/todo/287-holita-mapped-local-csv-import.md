# 287 Support mapped local CSV catalogue imports

**Status:** Ready. **Product:** Holita.

**Depends on** [176](176-holita-catalogue-import-history.md).

## Background

The red.bg coverage report marks IMP-03 as P2. Holita accepts fixed-column CSV imports, and ticket 176 covers import history. The source also allows a merchant to map supplied local columns.

## Goal

Support mapped local CSV catalogue imports.

## Steps

1. Add an operator API for explicit CSV column mapping and create-only, update-only and upsert modes for supported product and variant fields.
2. Reuse the existing scoped import batches, row results and retry contract.

## Done when

The same mapped CSV can create or update the expected rows according to the selected mode and report skipped or invalid rows in import history.

## Limits

Local upload only. Mapping for categories and stock is separate. Keep remote sources, feed schedules and a mapping wizard out.

## References

- [red.bg `MappedImportsController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Imports/MappedImportsController.php)
- [red.bg `ImportMode.php`](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Imports/ImportMode.php)
- [Holita `apps/commerce/src/commerce.graphql:899`](../../holita/apps/commerce/src/commerce.graphql#L899)
