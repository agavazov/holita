# 345 Allow approved Backoffice edits of a shop's public key

**Status:** Blocked. Waits for the shop directory and the approved public address policy. **Product:** Holita.

**Depends on** [238](238-holita-backoffice-shop-directory.md), [340](340-holita-primary-shop-public-address.md).

## Background

The red.bg coverage report marks OPS25 as P2. Backoffice rename changes a display name. The source also manages the store's public key.

## Goal

Allow approved Backoffice edits of a shop's public key.

## Steps

1. After the primary-address contract is approved, expose its authorized edit in the Backoffice shop detail and reuse the same alias operation and validation.

## Done when

An authorized operator can change an approved readable key and the original immutable Branch continues to own its catalog and records.

## Limits

No changes to workspace paths, record ownership or Tenant membership.

## References

- [red.bg `StoresController.php`](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoresController.php#L55)
- [red.bg `BackofficeManagementService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeManagementService.php#L174)
- [Holita `packages/operator/src/merchant-detail-page.ts:105`](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
- [Holita `apps/storefront/src/main.ts:919`](../../holita/apps/storefront/src/main.ts#L919)
