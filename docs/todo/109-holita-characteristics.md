# 109 Product characteristics

**Status:** Ready after [106](106-holita-product-editor.md). **Product:** Holita.

## Background

red.bg groups product characteristics independently of sellable variant options.

## Goal

Merchants add product specifications that shoppers can read.

## Steps

1. Keep group and characteristic names, order and active status, plus a text value per product and
   characteristic.
2. Add the Admin Characteristic Groups list and drawer. Add a Product drawer section for entering
   values by group.
3. Expose populated, active specifications on the storefront product page. Seed a Materials group
   with Material and Finish values on demo products.

## Done when

The merchant can edit a group and its values, and shoppers see the populated groups in order.

## Limits

Use text values. Variant selection stays with options.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Feature model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Catalog/Feature.php)
- [Feature group service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/FeatureGroupService.php)
- [Admin product characteristics](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/features.blade.php)
