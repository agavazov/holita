# 238 Find and rename shops from Backoffice

**Status:** Ready. **Product:** Holita.

## Background

red.bg has a cross-merchant shop directory and edit action. Holita's merchant directory returns compact pages, and merchant detail loads shops for the selected merchant.

## Goal

Let platform staff find any shop, inspect its owning merchant and correct its display name.

## Steps

1. Use a paginated Core shop directory with compact rows and an authorized scoped shop detail. Reuse the existing merchant directory pagination and platform authorization. Expose owner links, search and localized states. Add the destination to the existing Backoffice navigation or home links.
2. Add or reuse a scoped Core rename mutation that verifies the owner and Branch relationship. Refresh the directory and merchant detail after saving.

## Done when

Authorized staff can search for a shop and update its display name. The Branch and current shop URLs stay stable.

## Limits

Directory, detail and Branch name only. Leave existing creation and state changes on merchant detail.

## References

- [red.bg Backoffice stores](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoresController.php)
- [Existing Core merchant and Branch query](../../osnova/apps/core/src/modules/tenants/tenants.graphql#L71)
- [Holita Backoffice entry](../../holita/apps/backoffice/src/main.ts)
- [red.bg scoped Backoffice shop directory](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeManagementService.php#L129)
- [Holita current merchant branch detail](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
