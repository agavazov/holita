# 360 Keep the selected variant identifiable through checkout

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-02 identified this behavior at `1b44cc90`. Distinct variants with the same price can only be distinguished by SKU when the distinguishing option has been disabled. The cart and quote can hide that code.

## Goal

Keep the selected variant identifiable through checkout.

## Steps

Display the selected SKU in cart and checkout summaries. Cover the displayed variant identity in the quote comparison.

## Done when

Two such variants are distinguishable in the header cart, full cart and quote. A changed displayed SKU requires a fresh confirmation.

## Limits

Variant identity in cart and quote.

## References

- [main.ts](../../holita/apps/storefront/src/main.ts#L590)
- [product-relations.ts](../../holita/apps/commerce/src/products/product-relations.ts#L54)
- [cart.service.ts](../../holita/apps/commerce/src/cart/cart.service.ts#L113)
- [commerce.repository.ts](../../holita/apps/commerce/src/products/commerce.repository.ts#L320)
