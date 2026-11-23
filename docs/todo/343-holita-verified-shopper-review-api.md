# 343 Accept and read verified shopper reviews through the API

**Status:** Blocked. Waits for the verified review source decision in ticket 230. **Product:** Holita.

**Depends on** [230](230-holita-admin-review-moderation.md).

## Background

The red.bg coverage report marks REV-02 as P2. The source accepts a verified buyer's review of a purchased product and exposes approved reviews. The review moderation ticket awaits approval of the source.

## Goal

Accept and read verified shopper reviews through the API.

## Steps

1. After the owner approves this review source, accept one review per eligible authenticated shopper and product backed by an allowed order status in the same Branch.
2. Expose published reviews and their aggregate through the public catalogue contract. Reuse the record targeted by Admin moderation.

## Done when

Eligible shoppers can submit, another shopper's order cannot authorize submission, and only published reviews contribute to the public aggregate.

## Limits

API parity only. Exclude Basic review forms, importers and external review integrations.

## References

- [red.bg `storefront.php`](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/storefront.php#L93)
- [red.bg `ProductReviewService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/ProductReviewService.php)
- [Holita `apps/commerce/src/storefront.graphql:433`](../../holita/apps/commerce/src/storefront.graphql#L433)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
