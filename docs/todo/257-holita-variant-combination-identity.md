# 257 Preserve saved variant combination identity

**Status:** Ready. **Product:** Holita.

## Background

A shopper adds the red variant to a cart. Before checkout, a merchant changes the saved variant to blue. Commerce can reuse the variant ID and stock, so the cart resolves the line as blue and the shopper can place an order for a combination they never selected.

## Goal

Keep a saved variant ID tied to its original combination and prevent its inventory from carrying over to a different combination.

## Steps

1. Reject changing the combination of an existing variant ID in Commerce. Keep changes to ordinary variant fields and the existing deactivation and order-history rules.
2. In Admin, let the merchant add a new row for a new combination and manage the old row through the existing variant workflow. Show a field-level explanation if a save tries to change a persisted combination.
3. Extend the existing Commerce DB case with an open cart when a saved variant's combination is changed.

## Done when

The cart's red line stays red, or shows that the original variant is unavailable if it is deactivated. A new blue variant has its own ID and quantity. Past order lines and stock restoration still refer to the original variant under the existing rules.

## Limits

Keep changes within variant editing and the existing regression case. Variant matrix generation is separate.

## References

- [red.bg product and variant service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/ProductService.php#L456)
- [Holita product variant editor](../../holita/apps/admin/src/products/product-editor.ts#L728)
- [Holita variant replacement](../../holita/apps/commerce/src/products/commerce.repository.ts#L228)
- [Holita cart lookup](../../holita/apps/commerce/src/cart/cart.repository.ts#L102)
- [Existing Commerce DB case](../../holita/apps/commerce/test/commerce.db.spec.ts#L1329)
