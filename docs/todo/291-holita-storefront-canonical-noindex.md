# 291 Publish canonical URLs and route-level indexing rules in Basic

**Status:** Ready. **Product:** Holita.

**Depends on** [226](226-holita-catalogue-seo-metadata.md), [290](290-holita-product-slugs.md).

## Background

The red.bg coverage report marks SEO05 as P2. The Basic document has a static head. Ticket 228 serves robots and sitemap documents, covering a separate surface.

## Goal

Publish canonical URLs and route-level indexing rules in Basic.

## Steps

1. Use the supported current public shop origin and stable routes to set the canonical URL for public pages, including readable product URLs.
2. Add the documented noindex rules for search, filtered catalogue views, private views and shop errors. Share canonical generation with the sitemap where practical.

## Done when

An indexable product has its readable canonical URL, and a search route and shop error each emit the intended indexing directive.

## Limits

Use the current public origin and preserve the shop URL boundary. Verified alias routing and migration redirects are separate.

## References

- [red.bg `meta.blade.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/layouts/partials/meta.blade.php)
- [red.bg `CatalogSeoView.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/CatalogSeoView.php)
- [Holita `apps/storefront/src/index.html:3`](../../holita/apps/storefront/src/index.html#L3)
- [Holita `apps/storefront/src/main.ts:920`](../../holita/apps/storefront/src/main.ts#L920)
