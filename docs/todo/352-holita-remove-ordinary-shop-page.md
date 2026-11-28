# 352 Remove an ordinary shop page safely from Admin

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CN05 as P3. Admin can create and edit ordinary pages. Removing an outdated page also needs an explicit behavior when a shop menu points to it.

## Goal

Remove an ordinary shop page safely from Admin.

## Steps

1. Add a scoped removal action for ordinary pages and reject it with a useful reason while a current menu references the page.
2. Protect the system policy pages and keep current public page lookup behavior for removed slugs.

## Done when

A merchant can remove an unreferenced ordinary page, and a referenced or protected page remains available with a clear explanation.

## Limits

Reuse the current page list and navigation relationships. Keep redirect tooling separate.

## References

- [red.bg `PagesController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/PagesController.php)
- [red.bg `PageService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Content/PageService.php)
- [Holita `apps/commerce/src/pages/pages.service.ts:39`](../../holita/apps/commerce/src/pages/pages.service.ts#L39)
- [Holita `apps/admin/src/pages/pages-page.ts:89`](../../holita/apps/admin/src/pages/pages-page.ts#L89)
