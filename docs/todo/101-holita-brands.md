# 101 Brands, the reference feature

**Status:** Ready. **Product:** Holita.

## Background

Brands are the first feature that goes through the
[Holita feature skill](../../.agents/skills/holita-feature/SKILL.md) end to end. Later catalogue
tickets copy its shape, so it must be clean and look excellent. red.bg keeps brands in its API
catalogue models and Admin catalogue screens (see
[holita/docs/red-bg/services/api.md](../../holita/docs/red-bg/services/api.md) and
[admin.md](../../holita/docs/red-bg/services/admin.md)).

## Goal

A merchant manages the shop's brands in Admin, assigns a brand to a product, and shoppers see it.

## Steps

1. Commerce: a Brand model scoped by tenantId and branchId (name, slug unique per Branch, logo,
   status active/hidden, timestamps), an optional brand on Product, an additive migration, a
   repository and service, and operator SDL for list (search, sort, paging as the shared listing
   needs), create, update and delete.
2. Images: the logo upload is the first image upload in Holita. Implement it as the skill decides
   (local disk, Git-ignored, configured in `holita/config/commerce.env` and the root
   `.env.example`, written and served by Commerce, operator-only writes, raster formats with a size
   limit).
3. Admin: a Brands page from the shared Osnova listing with search and sort, an empty state, and a
   drawer editor (name, slug generated from the name and editable, logo upload with preview,
   status) using typed Reactive Forms. Add Brands to the navigation. The product editor gets a brand
   select.
4. Storefront: the storefront SDL exposes active brands and a product's brand; the product page and
   catalogue cards show the brand.
5. Seed: insert-only demo brands.
6. BG/EN texts for every new string.
7. Afterwards, adjust the skill with what this pilot taught, keeping it at most 80 lines.

## Done when

- Brands can be listed, searched, sorted, created, edited with a logo and deleted in Admin; a
  product can get a brand; the storefront shows it; another Branch never sees them.
- Screenshots of the Brands list, its empty state, the drawer, the product editor and the
  storefront product page at 1440x900 and 390x844, light and dark.
- `npm run check`, `npm run schema:check`, `npm run test:budget` and `npm run test:smoke:holita`
  pass.

## Limits

- Tests only as the delivery policy allows (Tenant/Branch isolation qualifies; extend an existing
  case where possible).
- No CDN, image resizing service or new dependency without a concrete need.

## References

- [Queue](holita-migration.md), [Holita rules](../../holita/AGENTS.md)
