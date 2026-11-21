# 104 Product options

**Status:** Ready after [102](102-holita-demo-shop.md). **Product:** Holita.

## Background

red.bg maintains reusable options and values for variant selection.

## Goal

Merchants define the options that variants will use.

## Steps

1. Keep option name, active status, filter visibility and ordered value labels. Scope options and
   values to the same shop.
2. Add the Admin Options list and drawer with inline value editing and ordering. Keep the option
   and value IDs stable when renamed.
3. Seed Colour with Sand and Graphite, and Size with Small and Large.

## Done when

The merchant can create and edit a reusable option with ordered values. The storefront starts
using those options in 113.

## Limits

Text labels only. Variant assignments land in 105.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Option model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Catalog/Option.php)
- [Option service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/OptionService.php)
- [Admin Options](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/options)
