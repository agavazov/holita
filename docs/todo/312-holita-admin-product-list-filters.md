# 312 Search descriptions and combine Admin product filters

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks PRD-03 as P2. The Admin product list supports name search and status. The source also helps merchants narrow large catalogues by product attributes.

## Goal

Search descriptions and combine Admin product filters.

## Steps

1. Add description search and combined category, brand, tag, badge, variant configuration and active status filters using the existing scoped list contract.

## Done when

A merchant can combine several filters with free text and paginate matching products within the shop.

## Limits

Reuse the existing Admin list and catalogue relations.

## References

- [red.bg `filters.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/filters.blade.php)
- [red.bg `ProductsController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Catalog/ProductsController.php#L15)
- [Holita `apps/commerce/src/products/commerce.repository.ts:53`](../../holita/apps/commerce/src/products/commerce.repository.ts#L53)
- [Holita `apps/admin/src/products/products-page.ts:80`](../../holita/apps/admin/src/products/products-page.ts#L80)
