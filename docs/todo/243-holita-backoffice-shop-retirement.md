# 243 Run approved shop retirement from Backoffice

**Status:** Blocked. Waiting for the approved and implemented Commerce cleanup in 242. **Product:** Holita. Depends on [238](238-holita-backoffice-shop-directory.md), [242](242-holita-commerce-retired-shop-cleanup.md).

## Background

red.bg can confirm a store purge in Backoffice. Holita can suspend the Branch, and an approved retirement must coordinate Core with the scoped Commerce cleanup.

## Goal

Let authorized staff start and see the result of an approved retirement.

## Steps

1. Wait for the approved and sized cleanup contract in 242. Add a confirmed action for an eligible suspended Branch in the shop directory detail.
2. Use Commerce completion before finalizing the Core Branch. Show pending, successful and failed states with the staff actor recorded.

## Done when

Staff can confirm an eligible test Branch retirement and recover failures through the approved path. A different Branch is untouched.

## Limits

Use the approved retention scope and isolated test data.

## References

- [red.bg store actions](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoresController.php)
- [Holita Backoffice entry](../../holita/apps/backoffice/src/main.ts)
