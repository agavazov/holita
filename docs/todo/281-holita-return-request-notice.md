# 281 Send a local confirmation for an accepted return request

**Status:** Ready. **Product:** Holita.

**Depends on** [210](210-holita-transactional-email-outbox.md), [215](215-holita-shopper-return-request.md).

## Background

The red.bg coverage report marks RT07 as P1. The local order notice flow does not confirm a new shopper return request.

## Goal

Send a local confirmation for an accepted return request.

## Steps

1. Emit one localized transactional notice per accepted request through the delivery path from 210, using the request reference, date and requested lines.

## Done when

The local mailbox contains one confirmation addressed to the verified shopper after the request is accepted.

## Limits

Keep live delivery under ticket 277 and avoid adding a Basic return form.

## References

- [red.bg `ReturnService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/ReturnService.php)
- [Holita `apps/commerce/src/storefront.graphql:433`](../../holita/apps/commerce/src/storefront.graphql#L433)
- [Holita `apps/commerce/src/refunds/refunds.service.ts:51`](../../holita/apps/commerce/src/refunds/refunds.service.ts#L51)
