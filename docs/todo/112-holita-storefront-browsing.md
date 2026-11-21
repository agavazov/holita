# 112 Storefront catalogue browsing

**Status:** Ready after [107](107-holita-product-images.md), [108](108-holita-collections.md), [110](110-holita-badges-tags.md), [111](111-holita-inventory.md). **Product:** Holita.

## Background

Basic has category, brand, collection and tag listings backed by the public catalogue.

## Goal

Shoppers can navigate the catalogue and narrow results within the current shop.

## Steps

1. Add category, brand, collection and tag indexes and product listings. Include subcategories on
   category pages.
2. Support paged results, name search, name or price sort, price range, brand, filterable options
   and in-stock filters in the public graph and URL.
3. Keep Admin on the existing catalogue screens. Seed a product that shares a category and brand
   with an existing fixture and differs in a filterable option or availability.

## Done when

A shopper can share a filtered URL and reopen the same results. Filters compose and omit hidden
products and choices.

## Limits

Use the basic storefront layout and existing Branch URL.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Catalogue read service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontProductReadService.php)
- [Basic routes](../../../red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php)
- [Basic filters](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/partials/product-filters.blade.php)
