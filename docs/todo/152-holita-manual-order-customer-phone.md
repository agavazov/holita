# 152 Use the maintained phone in new manual orders

**Status:** Ready. **Product:** Holita.

## Background

Customer Detail saves a phone on the customer profile. After a merchant corrects that phone, a new manual order still takes it from the customer's last linked order and can use the old number. A customer with no previous order can have a profile phone that the picker leaves unused.

## Goal

Selecting a customer for a new manual order uses their current profile phone.

## Steps

1. Select the profile phone in the Admin manual-order choices operation.
2. Prefill the phone from that field. Leave it empty when no profile phone is set, and preserve contact values the merchant has already typed.
3. Verify the new order snapshots the selected phone and existing orders retain their original contact details.

## Done when

Selecting the customer after a profile correction uses the new phone, including for a customer with no previous orders. A blank profile phone leaves the required field empty and a phone already typed on the draft is preserved. New orders snapshot the resulting phone and prior order contacts stay intact.

## Limits

Keep the existing scoped Admin query and contact editing workflow.

## References

- [red.bg manual order form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
- [Manual order choices operation](../../holita/apps/admin/src/orders/operations.graphql#L176)
- [Manual order customer autofill](../../holita/apps/admin/src/orders/manual-order-editor.ts#L172)
- [Customer contact update](../../holita/apps/commerce/src/customers/customers.service.ts#L90)
