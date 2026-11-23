# 344 Add product counts and merchant filters to the shop directory

**Status:** Ready. **Product:** Holita.

**Depends on** [238](238-holita-backoffice-shop-directory.md).

## Background

The red.bg coverage report marks OPS23 as P2. The basic directory in ticket 238 establishes a shop listing, detail and owner link. The source provides additional merchant and catalogue context.

## Goal

Add product counts and merchant filters to the shop directory.

## Steps

1. Add an authorized merchant filter and scoped product count to each directory row and detail. Show the current address and existing stable shop identifier through their contracts.

## Done when

Backoffice can find a shop for a chosen merchant and see the correct catalogue count. The address and shop identity come from the real record.

## Limits

No change to verified domain routing or to the underlying Branch identifier. Reuse displayed address once available.

## References

- [red.bg `StoresController.php`](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoresController.php)
- [red.bg `BackofficeManagementService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeManagementService.php#L129)
- [Holita `packages/operator/src/merchant-detail-page.ts:105`](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
- [Holita `apps/commerce/src/products/commerce.repository.ts:47`](../../holita/apps/commerce/src/products/commerce.repository.ts#L47)
