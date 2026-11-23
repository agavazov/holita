# 340 Define a stable readable primary address for a shop

**Status:** Needs owner. Should shops have a readable platform address, and who may change its key? **Product:** Holita.

**Depends on** [190](190-holita-shop-domain-aliases.md).

## Background

The red.bg coverage report marks SE05 as P2. Current Basic URLs use the immutable Branch UUID. The source also manages a primary public address and a readable shop key.

## Goal

Define a stable readable primary address for a shop.

## Steps

1. Confirm the readable platform address and roles that may change its key. Apply the canonical and inbound-link policy from 190 to existing `/s/:shopId` links.
2. Implement the approved scope with stable Branch identity and public URL resolution.

## Done when

The approved readable primary address identifies the right Branch, and previous links behave according to the approved policy.

## Limits

Separate from verifying a customer-owned alias and changing a shop's name. Keep generic redirect tooling out.

## References

- [red.bg `DomainsController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/DomainsController.php)
- [red.bg `DomainsController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Settings/DomainsController.php)
- [Holita `apps/storefront/src/main.ts:919`](../../holita/apps/storefront/src/main.ts#L919)
- [Holita `packages/operator/src/merchant-detail-page.ts:105`](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
