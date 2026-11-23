# 354 Filter the Admin category tree by activity and parent

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CAT-03 as P3. Admin can search category paths and retain ancestors. A merchant with a large category tree still needs to find inactive categories or one parent's children.

## Goal

Filter the Admin category tree by activity and parent.

## Steps

1. Add active and parent filters to the existing category list and retain visible ancestors for matching rows.

## Done when

The merchant can identify inactive categories or one parent's categories without manually scanning the entire tree.

## Limits

Keep bulk ordering in ticket 309.

## References

- [red.bg `filters.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/categories/partials/filters.blade.php)
- [Holita `apps/admin/src/categories/categories-page.ts:68`](../../holita/apps/admin/src/categories/categories-page.ts#L68)
- [Holita `apps/admin/src/categories/categories-page.html:30`](../../holita/apps/admin/src/categories/categories-page.html#L30)
