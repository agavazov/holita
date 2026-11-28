# 141 Convert a won lead to a new merchant and shop

**Status:** Ready after [143](143-holita-sales-core-provisioning.md). **Product:** Holita.

## Background

red.bg lets Sales create Core merchants and attach stores. Ticket 143 provides atomic,
replayable Core provisioning for a merchant, its administrator and first Branch. Commerce
already resolves a storefront shop using its Core Branch.

## Goal

Let a platform Sales agent provision a new merchant and shop from an unconverted Won lead,
then open both records from Lead Detail.

## Steps

1. Add Convert to new merchant on Lead Detail for a Won lead without a completed handoff.
   Use a shared editor for merchant name, administrator name/email, initial password and
   shop name. Prefill merchant and administrator fields from the lead and primary contact.
   Surface Core field errors in the editor.
2. Store one handoff per platform tenant and lead, with handoff ID, lead ID, mode
   (`newMerchant`), state, initiating Core user ID, created/updated/completed timestamps,
   and the merchant Tenant and Branch IDs returned by Core. While pending, retain the
   submitted non-password onboarding fields so a retry can replay the same input. Reserve
   the handoff operation ID in a Sales transaction that checks the lead is Won.
3. Call 143 with that ID and the originating Sales session. Complete the handoff after
   Core confirms. On a confirmed pre-commit rejection, allow correction and retry. After
   a lost response, retry the same operation and inputs. Let the agent re-enter a password
   only if Core still needs one for first creation. Never persist or log the password in
   Sales. Keep the lead Won while its handoff is pending or completed and enforce that
   rule for all stage writes.
4. On completion, link to the existing Sales merchant detail and `/s/<branchId>`. Verify
   the existing Commerce `shop` query resolves the Branch and the new administrator can
   select it with the shared sign-in.
5. Reuse the unconverted Won demo lead and seed a fictional primary contact for its form.
   Use isolated synthetic data when exercising new-merchant provisioning. Keep existing
   Core demo rows unchanged.

## Done when

A Sales agent can convert a Won lead and open both destination records. Other stages cannot
start a handoff. A failed input remains correctable. Retrying after a lost Core response
completes the same handoff with the original merchant and Branch. The storefront resolves
the new Branch and the new merchant administrator can sign in and select it.

## Limits

New merchant and first shop only. Tickets 144 and 304 add both existing-merchant handoff paths and ticket 142
adds reporting. No custom domains, catalogue copying, plan activation or credential
delivery.

## References

- [Atomic Core provisioning](143-holita-sales-core-provisioning.md)
- [Core merchant and shop contracts](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
- [Commerce public shop resolution](../../holita/apps/commerce/src/storefront.service.ts)
- [red.bg merchant creation](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/MerchantsController.php)
- [red.bg merchant form](../../../red.bg/workspace-sales/services/sales/resources/views/sales/merchants/partials/form.blade.php)
- [red.bg shop creation](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/StoresController.php)
- [Holita storefront shop lookup](../../holita/apps/commerce/src/storefront.service.ts#L243)
