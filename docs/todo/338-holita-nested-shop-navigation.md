# 338 Manage named shop menus and include them in navigation

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks NV02 as P2. Holita has one menu per position. The source also lets merchants create additional menus and include them from existing navigation.

## Goal

Manage named shop menus and include them in navigation.

## Steps

1. Add named shop-scoped menus and a destination type for an included menu. Protect system menus and reject cyclic or invalid references.

## Done when

Admin can add a secondary menu and show it from current Basic navigation. System menus and referenced menus follow the agreed deletion rules.

## Limits

Use the current Basic navigation rendering and preserve the protected policy links in the footer.

## References

- [red.bg `NavigationMenuService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Design/NavigationMenuService.php)
- [red.bg `NavigationMenuDefaultsService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/NavigationMenuDefaultsService.php)
- [Holita `apps/commerce/src/navigation/navigation.service.ts:135`](../../holita/apps/commerce/src/navigation/navigation.service.ts#L135)
- [Holita `apps/admin/src/navigation/navigation-page.ts:56`](../../holita/apps/admin/src/navigation/navigation-page.ts#L56)
