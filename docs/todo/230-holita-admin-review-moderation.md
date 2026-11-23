# 230 Moderate product reviews from an approved source

**Status:** Needs owner. May the verified-purchase shopper API supply reviews for merchant moderation? **Product:** Holita.

## Background

red.bg Admin approves, hides and removes product reviews. The reviewed Basic routes have no review display or submission screen. Holita has no approved source for moderation records.

## Goal

Let merchants moderate scoped product reviews once the source is approved.

## Steps

1. Confirm whether the implemented red.bg purchase-verified submission is an approved source and which product and shopper fields moderation needs.
2. Add the scoped record and Admin list with the implemented approve, hide and remove actions. Use localized states.

## Done when

A fixture using the approved record shape can be approved, hidden or deleted in its shop. Other shops cannot read or decide it. Verified shopper submission follows in 343.

## Limits

Deferred Admin moderation only. Keep new Basic review screens out of migration parity.

## References

- [red.bg review moderation](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Marketing/ReviewsController.php#L18)
- [red.bg review API](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/storefront.php#L93)
- [Holita shopper order history](../../holita/apps/storefront/src/shopper-orders-page.ts#L24)
