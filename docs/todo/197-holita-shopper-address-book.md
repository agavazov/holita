# 197 Extend the shared customer address model

**Status:** Ready. **Product:** Holita.

## Background

red.bg distinguishes delivery and billing addresses and allows merchants to remove a saved
address. Holita Admin supports creation and editing of one general address shape.

## Goal

Give shoppers and merchants one scoped saved-address model, with the missing Admin removal action.

## Steps

1. Add shipping and billing types, optional second address line and phone, and one optional
   default per customer and type. Preserve legacy addresses as general addresses available
   to either type of picker until updated. Use the same Commerce validation for both graphs.
2. Expose shopper-owned reads, create, update and removal using the verified shop session.
   Reuse those operations where appropriate for the authorized Admin customer context and
   add editing of the new fields and confirmed removal in Admin Customer Detail.

## Done when

A merchant can classify, update and remove a saved address in the selected shop. A customer
can access only their own addresses through the public graph. Historical order and invoice
snapshots remain intact.

## Limits

Shared model, operations and Admin behavior only. The Basic account address book follows in
305, and checkout callers have separate tickets.

## References

- [red.bg Admin customer address actions](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/CustomersController.php)
- [red.bg account address handling](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/AccountController.php)
- [Holita current saved-address model](../../holita/apps/commerce/prisma/schema.prisma#L501)
- [Holita current Admin address operations](../../holita/apps/commerce/src/customers/customers.service.ts#L110)
