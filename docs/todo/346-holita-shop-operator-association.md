# 346 Define which merchant operators may be assigned to a shop

**Status:** Needs owner. Which same-Tenant Core roles may assign or remove operator access to a shop, and what access should the assignment grant? **Product:** Holita.

**Depends on** [238](238-holita-backoffice-shop-directory.md).

## Background

The red.bg coverage report marks OPS25 as P2. The source supports managing associated merchant IDs. Holita operators are Core accounts and shop scope is a Branch within one Tenant.

## Goal

Define which merchant operators may be assigned to a shop.

## Steps

1. Confirm eligible staff and authorized actions, then connect the approved within-Tenant assignment rule to the existing Backoffice shop detail.

## Done when

An approved assignment grants only the expressly authorized access to the target shop, and a different Tenant is rejected.

## Limits

Apply the existing Tenant boundary. Changing a shop's key or owner is a separate contract.

## References

- [red.bg `StoresController.php`](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoresController.php#L55)
- [red.bg `BackofficeManagementService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeManagementService.php#L174)
- [Holita `packages/operator/src/merchant-detail-page.ts:105`](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
- [Holita `osnova/apps/core/src/modules/platform/platform.service.ts:48`](../../osnova/apps/core/src/modules/platform/platform.service.ts#L48)
