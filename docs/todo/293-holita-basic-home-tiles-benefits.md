# 293 Configure fixed Basic homepage tiles and benefits

**Status:** Ready. **Product:** Holita.

**Depends on** [188](188-holita-basic-home-content.md).

## Background

The red.bg coverage report marks ST02 as P2. Ticket 188 supplies the fixed homepage hero and announcement. The source also lets the merchant edit three promotion tiles and four benefits.

## Goal

Configure fixed Basic homepage tiles and benefits.

## Steps

1. Add scoped settings for section visibility and the existing Basic text, local image and internal link fields for the fixed slots.
2. Render populated enabled sections through the home layout from ticket 188.

## Done when

A merchant can configure and hide the sections, and Basic displays the selected local images and links only for the requested shop.

## Limits

Fixed Basic sections only. Keep reusable media libraries, video and theme tooling outside this run.

## References

- [red.bg `StorefrontBasicController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/StorefrontBasicController.php)
- [red.bg `home.blade.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/home.blade.php)
- [Holita `apps/commerce/src/shop-settings/shop-settings.service.ts:24`](../../holita/apps/commerce/src/shop-settings/shop-settings.service.ts#L24)
- [Holita `apps/storefront/src/main.ts:31`](../../holita/apps/storefront/src/main.ts#L31)
