# 152 Use the maintained phone in new manual orders

**Status:** Ready. **Product:** Holita.

## Background

Customer Detail saves a phone on the customer profile. The manual order picker still prefills the phone from the customer's last linked order, so a corrected number can be missed.

## Goal

Selecting a customer for a new manual order uses their current profile phone.

## Steps

1. Select the profile phone in the Admin manual-order choices operation.
2. Prefill the phone from that field. Leave it empty when no profile phone is set, and preserve contact values the merchant has already typed.
3. Verify the new order snapshots the selected phone and existing orders retain their original contact details.

## Done when

Updating a customer's profile phone and selecting the customer in a new manual order displays the updated number. Clearing the profile phone leaves the required field empty. Prior order contacts stay intact.

## Limits

Keep the existing scoped Admin query and contact editing workflow.

## References

- [Manual order choices operation](../../holita/apps/admin/src/orders/operations.graphql#L163)
- [Manual order customer autofill](../../holita/apps/admin/src/orders/manual-order-editor.ts#L172)
- [Customer contact update](../../holita/apps/commerce/src/customers/customers.service.ts#L90)
