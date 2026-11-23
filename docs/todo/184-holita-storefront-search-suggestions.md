# 184 Suggest products during storefront search

**Status:** Ready. **Product:** Holita.

## Background

red.bg Basic returns lightweight product suggestions while a shopper types. Holita catalogue search applies a submitted filter only.

## Goal

Give a shopper direct links to public product matches while typing.

## Steps

1. Reuse the scoped public search query for a small set of suggestions. Render keyboard-accessible suggestion links to active product detail and keep the submitted search route.
2. Handle pending, no matches and failure in Bulgarian and English.

## Done when

Typing a product prefix suggests matching active products in the current shop, and selecting one opens its detail.

## Limits

Reuse Holita's search storage and contracts where possible. No external search engine.

## References

- [red.bg Basic search controller](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/StorefrontController.php)
- [Holita catalogue browser](../../holita/apps/storefront/src/catalogue-browse.ts)
- [red.bg suggestion partial](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/partials/search-suggestions.blade.php)
- [Holita current public catalogue search](../../holita/apps/commerce/src/products/catalogue.repository.ts#L239)
