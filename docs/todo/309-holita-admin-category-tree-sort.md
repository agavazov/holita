# 309 Save Admin category tree changes together

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CAT-02 as P2. Admin currently edits the parent and position of one category at a time.

## Goal

Save Admin category tree changes together.

## Steps

1. Provide a scoped tree view that lets an operator reorder siblings and move categories between parents.
2. Validate the submitted tree within the shop and save all changed parents and positions together through a single operation.

## Done when

An operator can move and order several categories in one save, and an invalid tree leaves the existing structure intact.

## Limits

Reuse the existing category model and shared Admin patterns.

## References

- [red.bg `admin.php`](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php#L337)
- [red.bg `sort.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/categories/sort.blade.php)
- [Holita `apps/admin/src/categories/category-editor.html:57`](../../holita/apps/admin/src/categories/category-editor.html#L57)
- [Holita `apps/commerce/src/categories/categories.service.ts:85`](../../holita/apps/commerce/src/categories/categories.service.ts#L85)
