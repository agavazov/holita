# 103 Category tree

**Status:** Ready. **Product:** Holita.

## Background

red.bg organizes products in a shop-owned category tree.

## Goal

Merchants organize products into ordered categories and subcategories.

## Steps

1. Keep name, slug, parent, sort order and active status. Add an optional category to a product.
2. Add the Admin Categories tree and drawer for create, edit, move, reorder and delete. Add a
   category select to the Product drawer. Reject cycles and deletion of categories with children
   or assigned products.
3. Expose the active tree and a product’s active category in the storefront SDL. Add category
   breadcrumbs on the product page.
4. Seed Kitchen and Home with two child categories each, plus new products assigned to child
   categories.

## Done when

A merchant can move and assign a category, and shoppers see the correct breadcrumbs. Inactive
categories and their subtrees are omitted from the public tree.

## Limits

One category per product. Category browsing lands in 112.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Category model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Catalog/Category.php)
- [Category moves](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/CategoryService.php)
- [Admin Categories](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/categories)
