# 228 Publish an origin-wide robots file and scoped shop sitemaps

**Status:** Ready after [123](123-holita-pages.md), [124](124-holita-blog.md). **Product:** Holita.

## Background

red.bg Basic serves robots.txt and a sitemap on each shop origin. Holita shops share an origin under /s/<branchId>.

## Goal

Publish one robots response at the origin root and a sitemap for each shop's public paths.

## Steps

1. Serve a single /robots.txt at the storefront origin and expose each eligible shop sitemap under its current Branch path. Advertise the sitemap entries in an origin-appropriate way.
2. Include only public eligible catalogue and published content URLs. Keep drafts, private routes and other shops out of each sitemap.

## Done when

The origin returns one robots file, and two shops' sitemaps contain only their respective eligible URLs.

## Limits

Use the existing Branch paths and configured public origin. Do not require a per-shop locale policy or external index submission.

## References

- [Holita shop routing](../../holita/AGENTS.md)
- [red.bg Basic robots and sitemap routes](../../../red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php#L39)
- [Holita public graph](../../holita/apps/commerce/src/storefront.graphql)
