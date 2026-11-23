# 266 Confirm Backoffice suspension before sending it

**Status:** Ready. **Product:** Holita.

## Background

Clicking Suspend immediately sends a mutation. An accidental click can take a shop, or every shop belonging to a merchant, offline. The action stays available while its request is pending.

## Goal

Make Backoffice suspension deliberate and prevent repeated clicks during the request.

## Steps

1. Use the shared confirmation pattern for merchant and shop suspension. Identify the selected record and the effect in localized copy.
2. Disable the confirmed action while its request is pending and use the existing result feedback. Preserve current authorization and reactivation.

## Done when

Cancelling sends no mutation. Confirming suspends only the merchant or shop named by the prompt, and repeated clicks during the request send no extra mutation.

## Limits

Keep the current Core suspension contract and existing Backoffice actions.

## References

- [red.bg Backoffice merchant suspension](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/MerchantsController.php#L133)
- [Holita merchant suspension action](../../holita/packages/operator/src/merchants-page.ts#L212)
- [Holita shop suspension action](../../holita/packages/operator/src/merchant-detail-page.ts#L180)
