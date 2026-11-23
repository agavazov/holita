# 285 Provide protected shop policy pages in the Basic footer

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CN04 as P1. Holita has ordinary pages and manual footer items. The source provides shop-owned Terms, Privacy and Cookies pages with protected paths.

## Goal

Provide protected shop policy pages in the Basic footer.

## Steps

1. Provision the three stable slugs per shop and protect their identities through the current page controls.
2. Render the shop's published content and footer links through its existing Basic page and navigation paths.

## Done when

The merchant can edit and publish all three shop-owned pages. Footer links use their stable URLs and every page is scoped to the current shop.

## Limits

The merchant supplies policy text. Reuse the delivered content and navigation workflows and avoid a new renderer.

## References

- [red.bg `PageDefaultsService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Content/PageDefaultsService.php)
- [red.bg `PageService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Content/PageService.php)
- [Holita `apps/commerce/src/pages/pages.service.ts:39`](../../holita/apps/commerce/src/pages/pages.service.ts#L39)
- [Holita `apps/storefront/src/storefront-content.ts:6`](../../holita/apps/storefront/src/storefront-content.ts#L6)
