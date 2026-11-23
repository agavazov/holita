# 227 Edit SEO metadata for shop content

**Status:** Ready after [226](226-holita-catalogue-seo-metadata.md). **Product:** Holita.

## Background

red.bg has editable metadata for content pages and blog articles. Holita already ships pages and blog articles with title, body and publication state through commits `9e480781` and `9253543e`.

## Goal

Extend the merchant SEO editor to published content pages and articles.

## Steps

1. Add optional localized SEO fields to those records and reuse the 226 Admin SEO worklist and editor pattern for both record types.
2. Apply metadata and fallbacks on Basic content and article routes. Keep draft metadata private.

## Done when

A merchant can set the page and article search titles and descriptions, and published routes display those values in the selected language.

## Limits

Plain text metadata. Preserve page and blog scope and publication rules.

## References

- [red.bg SEO work queue](../../../red.bg/workspace-ecommerce/services/api/app/Services/Seo/SeoWorkQueueService.php)
- [red.bg Basic blog metadata](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/BlogSeoView.php)
- [Holita public content and article routes](../../holita/apps/storefront/src/main.ts#L921)
