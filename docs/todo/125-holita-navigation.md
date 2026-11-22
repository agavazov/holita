# 125 Shop navigation menus

**Status:** Ready after [123](123-holita-pages.md), [124](124-holita-blog.md). **Product:** Holita.

## Background

red.bg allows merchants to arrange ordered links to shop destinations.

## Goal

Merchants edit the links shoppers see in the storefront header and footer.

## Steps

1. Keep header and footer menu placements, ordered link rows, BG/EN labels and destinations for
   categories, collections, pages, the blog and HTTP(S) URLs.
2. Add an Admin Navigation list with a menu drawer and destination picker. Resolve shop
   destinations from the current Branch and omit unpublished or inactive targets publicly.
3. Seed a header linking to Kitchen and the blog, and a footer linking to the two published pages.

## Done when

Reordering or editing links changes the corresponding storefront menu, and an unpublished target
disappears.

## Limits

Use one level of links and the basic storefront shell.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Navigation service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Design/NavigationMenuService.php)
- [Navigation item model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Storefront/NavigationMenuItem.php)
- [Admin Navigation](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/design/navigation)
- [Public navigation reads](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontNavigationService.php)
