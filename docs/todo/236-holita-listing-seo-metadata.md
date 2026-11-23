# 236 Edit SEO metadata for the shop and catalogue listings

**Status:** Ready after [226](226-holita-catalogue-seo-metadata.md). **Product:** Holita.

## Background

red.bg metadata editing also covers the shop, brands and collections. Holita shop settings shipped in `946cb21d`. Ticket 226 introduces the SEO worklist/editor for products and categories.

## Goal

Apply the SEO editor and localized fallbacks to the shop landing page and brand and collection listings.

## Steps

1. Add optional localized metadata for those records and expose them through the 226 worklist and editor.
2. Use stored values or an appropriate fallback on eligible public listing routes.

## Done when

Merchants can edit metadata for these destinations and the selected shop and language renders the correct text.

## Limits

Basic SEO only. No campaign data, theme or external tools.

## References

- [red.bg SEO coverage](../../../red.bg/workspace-ecommerce/services/api/app/Services/Seo/SeoWorkQueueService.php)
- [Holita catalogue browsing](../../holita/apps/storefront/src/catalogue-browse.ts)
- [red.bg Basic homepage metadata](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/HomepageSeoView.php)
- [Holita shop settings reads](../../holita/apps/commerce/src/shop-settings/shop-settings.service.ts#L24)
- [Holita storefront listing routes](../../holita/apps/storefront/src/main.ts#L919)
