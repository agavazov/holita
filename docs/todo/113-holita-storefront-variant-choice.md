# 113 Storefront product variant choice

**Status:** Ready. **Product:** Holita.

## Background

Basic renders the variant choices and availability on the product page.

## Goal

Shoppers select a sellable combination and see its price and availability.

## Steps

1. Use the public product query to return active combinations and ordered option labels, with
   variant ID, SKU, price and availability.
2. Update the product page to retain the gallery and specifications, select the default variant
   when available and refresh the price and availability on selection. Disable incompatible
   combinations.
3. Keep the Admin Product drawer as the source of choices. Seed a new product with one available
   combination and one sold-out combination at different prices.

## Done when

Simple and configurable products both show the right price. The page identifies a valid sellable
variant for the cart.

## Limits

Cart actions land in 114.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Product read service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontProductReadService.php)
- [Basic product page](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/product.blade.php)
- [Basic variant selector](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/partials/product-variant-selection.blade.php)
