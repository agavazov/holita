# 227 Edit SEO metadata for shop content

**Status:** Ready after [123](123-holita-pages.md), [124](124-holita-blog.md), [226](226-holita-catalogue-seo-metadata.md). **Product:** Holita.

## Background

red.bg has editable metadata for content pages and blog articles. Holita's queued page and blog records cover title, body and publication state.

## Goal

Extend the merchant SEO editor to published content pages and articles.

## Steps

1. Add optional localized SEO fields to those records and include them in the appropriate Admin SEO list.
2. Apply metadata and fallbacks on Basic content and article routes. Keep draft metadata private.

## Done when

A merchant can set the page and article search titles and descriptions, and published routes display those values in the selected language.

## Limits

Plain text metadata. Preserve page and blog scope and publication rules.

## References

- [red.bg SEO work queue](../../../red.bg/workspace-ecommerce/services/api/app/Services/Seo/SeoWorkQueueService.php)
- [Content queue](../../docs/todo/123-holita-pages.md)
- [Blog queue](../../docs/todo/124-holita-blog.md)
