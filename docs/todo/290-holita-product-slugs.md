# 290 Give products stable readable shop URLs

**Status:** Ready. **Product:** Holita.

**Depends on** [226](226-holita-catalogue-seo-metadata.md), [228](228-holita-storefront-sitemap.md).

## Background

The red.bg coverage report marks PRD-04 as P2. Basic product links currently identify the product by UUID. The source supports a readable slug scoped to the shop.

## Goal

Give products stable readable shop URLs.

## Steps

1. Add a shop-unique product slug to the catalogue contract and Admin editor, using a documented default for existing catalogue rows.
2. Emit the readable product link through the existing Basic route and sitemap, and continue resolving saved UUID links for that same product. Preserve the existing product metadata.

## Done when

The shop can open an active product by its readable URL and by an existing UUID URL. Its sitemap uses the readable URL, and identical slugs in separate shops resolve correctly.

## Limits

Ticket 291 handles canonical and noindex metadata and ticket 228 handles sitemap entries. Exclude a generic redirect editor.

## References

- [red.bg `ProductsController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Catalog/ProductsController.php#L365)
- [red.bg `web.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php#L68)
- [Holita `apps/storefront/src/main.ts:920`](../../holita/apps/storefront/src/main.ts#L920)
- [Holita `apps/commerce/src/products/catalogue.repository.ts:54`](../../holita/apps/commerce/src/products/catalogue.repository.ts#L54)
