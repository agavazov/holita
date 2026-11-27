# 305 Show the saved address book in Basic

**Status:** Ready. **Product:** Holita.

## Background

Ticket 197 adds the shared saved-address contract, including shipping and billing kinds and
shopper-owned operations. red.bg Basic has an account screen for maintaining these records.

## Goal

Let a signed-in shopper maintain the addresses saved to their account in the current shop.

## Steps

1. Add a Basic account address book using the 197 operations. List each address, its kind and
   any default, with BG/EN loading, empty and error states.
2. Use one localized form for create and edit. Support changing a default and confirming
   removal while keeping the normal sign-in and shop context.

## Done when

A shopper can add, edit, select a default and remove addresses in their own account. Switching
shops loads that shop's own address book, and saved order snapshots stay intact.

## Limits

Account address book only. Checkout selection and manual orders follow in separate tickets.

## References

- [red.bg Basic account address actions](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/AccountController.php)
- [Holita account route](../../holita/apps/storefront/src/main.ts#L937)
- [Holita verified shopper scope](../../holita/apps/commerce/src/storefront.service.ts#L514)
