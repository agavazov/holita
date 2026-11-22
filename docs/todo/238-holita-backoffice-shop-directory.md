# 238 Find and rename shops from Backoffice

**Status:** Ready. **Product:** Holita.

## Background

red.bg has a cross-merchant shop directory and edit action. Holita's existing authorized Core merchant query already returns Branch name, status and owning merchant.

## Goal

Let platform staff find any shop, inspect its owning merchant and correct its display name.

## Steps

1. Reuse the existing Core merchant query for a cross-merchant shop list and detail with localized states and links to the owner merchant. Add the destination to the existing Backoffice navigation or home links.
2. Add or reuse a scoped Core rename mutation that verifies the owner and Branch relationship. Refresh the directory and merchant detail after saving.

## Done when

Authorized staff can search for a shop and update its display name. The Branch and current shop URLs stay stable.

## Limits

Directory, detail and Branch name only. Leave existing creation and state changes on merchant detail.

## References

- [red.bg Backoffice stores](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoresController.php)
- [Existing Core merchant and Branch query](../../osnova/apps/core/src/modules/tenants/tenants.graphql#L71)
- [Holita Backoffice entry](../../holita/apps/backoffice/src/main.ts)
