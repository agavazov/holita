# 182 Manage shop inquiries in Admin

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin lists contact inquiries, opens their content and updates status. Holita has no inquiry record. Public contact information shipped in `946cb21d`.

## Goal

Let merchants read and close inquiries for their shop.

## Steps

1. Add a scoped Commerce inquiry record and authorized reads and status writes. Keep the original sender, subject and message.
2. Add an Admin list and detail with localized states, status and date filters, and a demo inquiry.

## Done when

Merchants can find, open and update a demo inquiry only in its own shop.

## Limits

Local inbox only. The public contact form is separate.

## References

- [red.bg inquiry controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/RequestsController.php)
- [Current operator contract](../../holita/apps/commerce/src/commerce.graphql)
- [Holita scoped operator query entry](../../holita/apps/commerce/src/commerce.graphql#L894)
