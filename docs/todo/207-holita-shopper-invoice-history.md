# 207 Find and download issued invoices in shopper accounts

**Status:** Ready. **Product:** Holita.

## Background

red.bg Basic can list, display and download a shopper's issued invoices. Holita My Account lists orders only. Admin uses a reusable PDF renderer.

## Goal

Let signed-in shoppers find and download invoices for their own orders in the selected shop.

## Steps

1. Expose owner-scoped invoice list and detail using the verified shop session. Add account routes with loading, empty, unavailable and error states.
2. Use the existing PDF renderer, including saved VAT fields whenever the shared renderer supports them. Recheck shop and owning customer for the document response and keep operator-only fields private.

## Done when

A shopper can open and download their own issued invoice and cannot access another shopper's or shop's invoice by changing its ID.

## Limits

Issued shopper-owned documents only. Preserve the same snapshot that the merchant sees.

## References

- [red.bg Basic invoice routes](../../../red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php)
- [Holita account routes](../../holita/apps/storefront/src/main.ts)
- [Holita storefront contract](../../holita/apps/commerce/src/storefront.graphql)
- [Holita existing shopper order routes](../../holita/apps/storefront/src/main.ts#L932)
