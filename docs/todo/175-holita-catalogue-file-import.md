# 175 Import catalogue rows from a fixed-format local CSV

**Status:** Ready. **Product:** Holita.

## Background

red.bg implements mapped imports through its merchant API and job visibility in Admin. Holita has direct product editing without a local bulk import.

## Goal

Import a documented fixed-column CSV into the selected shop and retain durable row results.

## Steps

1. Define one local CSV format for basic product and variant fields. Add one authorized, shop-scoped Admin file submission so a merchant can select and send that CSV directly.
2. Use existing catalogue validation and shop ownership rules. Save a job and durable row outcomes, including row number, result and enough normalized input to retry eligible failures. Return the job ID.

## Done when

An authorized merchant can submit the documented local CSV from Admin, see the job identifier and distinguish applied and rejected rows in the returned result. A different shop cannot read or alter those results.

## Limits

One fixed CSV format and one file submission action. Keep the history and retry UI in 176 and external sources outside scope.

## References

- [red.bg mapped imports API](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Imports/MappedImportsController.php#L23)
- [red.bg Admin import routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php#L299)
- [Holita catalogue contract](../../holita/apps/commerce/src/commerce.graphql)
- [Holita catalogue operator mutations](../../holita/apps/commerce/src/commerce.graphql#L995)
