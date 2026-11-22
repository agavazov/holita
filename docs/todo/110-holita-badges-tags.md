# 110 Product badges and tags

**Status:** Ready. **Product:** Holita.

## Background

red.bg manages reusable badges and assigns badges and tags in the product form.

## Goal

Merchants label products for merchandising and discovery.

## Steps

1. Keep badge name, slug, active status, colour and order. Keep tag name and slug. Assign both to
   products within the same shop.
2. Add an Admin Badges list and drawer and a Product drawer picker for badges and searching or
   creating tags.
3. Expose active badges on storefront cards and tags on product pages. Seed a New Arrival badge
   and two tags on existing demo products using new assignments.

## Done when

Shoppers see assigned active badges and the product’s tags after a merchant saves the product.

## Limits

Tag browsing lands in 112. Use existing badge colours from the design system.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Badge model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Catalog/ProductBadge.php)
- [Tag service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/ProductTagService.php)
- [Admin product markers](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/catalog-markers.blade.php)
