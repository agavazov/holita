# 212 Initiate a verified customer email correction

**Status:** Ready after [211](211-holita-shopper-email-change.md). **Product:** Holita.

## Background

red.bg Admin exposes a customer's pending email correction and lets merchants create and cancel it. Holita keeps email read-only in Admin.

## Goal

Let a merchant initiate a verified correction for a customer in the selected shop.

## Steps

1. Add a scoped Admin action and display pending status on Customer Detail. Reuse the shop email verification workflow.
2. Let the merchant cancel a pending correction and show localized duplicate or delivery errors.

## Done when

The shopper retains their current sign-in until they prove ownership of the replacement email.

## Limits

Use the shared email-change policy. Do not expose confirmation credentials to operators.

## References

- [red.bg Admin customers](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/CustomersController.php)
- [Holita customer detail](../../holita/apps/admin/src/customers/customer-detail.html)
