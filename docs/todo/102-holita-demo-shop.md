# 102 Demo shop data

**Status:** Ready. **Product:** Holita.

## Background

The demo merchant `admin@demo.holita.test` (passwords only in the Git-ignored
`holita/config/seed-accounts.env`) has a shop with a few placeholder products. To judge the look of
Admin and the storefront, and to test later features on real-looking data, the shop needs a
realistic Bulgarian catalogue.

## Goal

The demo shop looks like a real Bulgarian online shop in Admin and in the storefront.

## Steps

1. Choose one coherent shop theme (for example home and kitchen goods) and write an insert-only
   seed in `holita/tools/` that `npm run db:seed:holita` runs: about 8 brands with logos and about
   40 products with Bulgarian names, realistic BGN prices, statuses and brands. Products use only
   fields that exist when this ticket runs; later tickets extend the same seed with categories,
   variants, descriptions and images.
2. Generate every image locally (no downloads, no stock or copyrighted photos, no new dependency
   without a concrete need) into the image directory the skill defines.
3. Keep the seed insert-only and idempotent: a second run changes nothing, and existing rows are
   never updated.
4. Add a short "Demo shop seed" rule to the skill so that later tickets extend this seed.

## Done when

- After `npm run db:seed:holita`, the Admin product and brand lists and the storefront catalogue
  look like a real shop; screenshots at 1440x900 and 390x844, light and dark.
- A second seed run inserts nothing.
- `npm run check`, `npm run test:budget` and `npm run test:smoke:holita` pass.

## Limits

- Holita development databases only; never the `discocan_*` databases. Never reset a database.

## References

- [Queue](holita-migration.md)
