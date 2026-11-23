# 288 Accept mapped local XML catalogue files

**Status:** Ready. **Product:** Holita.

**Depends on** [287](287-holita-mapped-local-csv-import.md).

## Background

The red.bg coverage report marks IMP-03 as P2. The shared mapped import pipeline starts with CSV. The source also accepts mapped local XML.

## Goal

Accept mapped local XML catalogue files.

## Steps

1. Add one documented local XML record format with explicit mapping into the validated product and variant input used by CSV.
2. Reuse batch outcomes, per-row errors and import modes from ticket 287.

## Done when

A local XML file creates or updates the same scoped records as an equivalent CSV and reports invalid records through the common import history.

## Limits

Accept local file data only. Keep external entity resolution and remote retrieval disabled.

## References

- [red.bg `MappedImportsController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Imports/MappedImportsController.php)
- [red.bg `ImportMode.php`](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Imports/ImportMode.php)
- [Holita `apps/commerce/src/commerce.graphql:899`](../../holita/apps/commerce/src/commerce.graphql#L899)
