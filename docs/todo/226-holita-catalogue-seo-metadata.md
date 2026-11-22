# 226 Edit product and category SEO metadata

**Status:** Ready. **Product:** Holita.

## Background

red.bg exposes catalogue SEO completeness and inline metadata editing in Admin. Holita lacks merchant-edited metadata and uses the same static document title.

## Goal

Let merchants set search titles and descriptions for products and categories.

## Steps

1. Add optional BG/EN SEO title and description fields, fallback rules and a shop-scoped Admin list showing missing metadata.
2. Apply saved fields or derived fallbacks in the public storefront page metadata.

## Done when

Editing a product or category updates that shop's public page title and description in the selected language.

## Limits

Start with products and categories. Keep theme editing, analytics connectors and SEO provider integrations out.

## References

- [red.bg SEO editor](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Marketing/SeoController.php)
- [red.bg SEO work queue](../../../red.bg/workspace-ecommerce/services/api/app/Services/Seo/SeoWorkQueueService.php)
- [Holita storefront entry](../../holita/apps/storefront/src/main.ts)
