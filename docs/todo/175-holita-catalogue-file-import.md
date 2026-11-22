# 175 Import catalogue rows from a fixed-format local CSV

**Status:** Ready. **Product:** Holita.

## Background

red.bg implements mapped imports through its merchant API and job visibility in Admin. Holita has direct product editing without a local bulk import.

## Goal

Import a documented fixed-column CSV into the selected shop and retain durable row results.

## Steps

1. Define one local CSV format for the basic product and variant fields and accept it through a scoped import entry point.
2. Use existing catalogue validation and shop ownership rules. Save a job and durable row outcomes, including row number, result and enough normalized input to retry eligible failures. Return the job ID.

## Done when

A local import can apply valid rows and identify rejected rows from stored results. A different shop cannot read or alter those results.

## Limits

One fixed CSV format, with no upload or mapping wizard. Keep the history and retry UI in 176 and external sources outside scope.

## References

- [red.bg mapped imports API](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Imports/MappedImportsController.php#L23)
- [red.bg Admin import routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php#L299)
- [Holita catalogue contract](../../holita/apps/commerce/src/commerce.graphql)
