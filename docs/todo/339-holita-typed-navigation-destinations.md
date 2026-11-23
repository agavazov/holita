# 339 Choose scoped catalogue and content destinations for shop menus

**Status:** Ready. **Product:** Holita.

**Depends on** [290](290-holita-product-slugs.md).

## Background

The red.bg coverage report marks NV03 as P2. Admin supports some typed link destinations. Others still require a manually copied URL.

## Goal

Choose scoped catalogue and content destinations for shop menus.

## Steps

1. Extend the destination selector for product, brand, specific article and Basic routes for home, catalogue, search and contacts using published scoped reads.
2. Resolve menu links through canonical public routes and handle destinations that are no longer public using the existing navigation policy.

## Done when

The merchant can link to each supported destination without typing its URL. Basic does not expose an unpublished or other-shop destination.

## Limits

Reuse the current menu and destination contracts.

## References

- [red.bg `NavigationDestinationType.php`](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Storefront/NavigationDestinationType.php)
- [red.bg `NavigationDestinationService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Design/NavigationDestinationService.php)
- [Holita `apps/commerce/src/navigation/navigation.service.ts:135`](../../holita/apps/commerce/src/navigation/navigation.service.ts#L135)
- [Holita `apps/admin/src/navigation/navigation-page.ts:56`](../../holita/apps/admin/src/navigation/navigation-page.ts#L56)
