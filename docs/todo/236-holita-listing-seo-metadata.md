# 236 Edit SEO metadata for the shop and catalogue listings

**Status:** Ready after [126](126-holita-general-settings.md), [226](226-holita-catalogue-seo-metadata.md). **Product:** Holita.

## Background

red.bg metadata editing also covers the shop, brands and collections. The first Holita SEO slice brings product and category editing.

## Goal

Apply the SEO editor and localized fallbacks to the shop landing page and brand and collection listings.

## Steps

1. Add optional localized metadata for those records and expose them through the existing SEO editor.
2. Use stored values or an appropriate fallback on eligible public listing routes.

## Done when

Merchants can edit metadata for these destinations and the selected shop and language renders the correct text.

## Limits

Basic SEO only. No campaign data, theme or external tools.

## References

- [red.bg SEO coverage](../../../red.bg/workspace-ecommerce/services/api/app/Services/Seo/SeoWorkQueueService.php)
- [Holita catalogue browsing](../../holita/apps/storefront/src/catalogue-browse.ts)
