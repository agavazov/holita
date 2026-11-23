# 327 List a shopper's own return requests

**Status:** Ready. **Product:** Holita.

**Depends on** [201](201-holita-admin-return-cases.md), [215](215-holita-shopper-return-request.md).

## Background

The red.bg coverage report marks RT04 as P2. Ticket 215 accepts requests but does not list them.

## Goal

List a shopper's own return requests.

## Steps

1. Add an authenticated paginated storefront query for the shopper's own Branch return requests, including current status and requested lines.

## Done when

A signed-in shopper can read their own return requests. Requests from another shopper or Branch are excluded.

## Limits

Storefront API only. Reuse the case and auth contracts. No new Basic screen.

## References

- [red.bg `ReturnsController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Storefront/Customer/ReturnsController.php)
- [Holita `apps/commerce/src/storefront.graphql:426`](../../holita/apps/commerce/src/storefront.graphql#L426)
- [Holita `apps/commerce/src/refunds/refunds.service.ts:51`](../../holita/apps/commerce/src/refunds/refunds.service.ts#L51)
