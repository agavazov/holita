# 292 Publish Basic social cards and product structured data

**Status:** Ready. **Product:** Holita.

**Depends on** [291](291-holita-storefront-canonical-noindex.md).

## Background

The red.bg coverage report marks SEO06 as P2. SEO title and description fields are planned. Basic still needs social metadata and public structured data.

## Goal

Publish Basic social cards and product structured data.

## Steps

1. Use the canonical URL, data already visible to shoppers, current currency and available product imagery for Open Graph and Twitter metadata.
2. Emit valid product, breadcrumb and list structured data where the relevant public route supports it.

## Done when

A public product exposes matching title, price, currency and availability, and breadcrumbs use canonical public URLs. Private or error routes expose no product structured data.

## Limits

Use the existing public currency contract. Keep templates inside Basic and avoid fetching from external sharing or schema services.

## References

- [red.bg `ProductSeoView.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/ProductSeoView.php)
- [red.bg `SeoData.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/SeoData.php)
- [Holita `apps/storefront/src/index.html:3`](../../holita/apps/storefront/src/index.html#L3)
- [Holita `apps/commerce/src/storefront.graphql:137`](../../holita/apps/commerce/src/storefront.graphql#L137)
