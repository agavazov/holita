# 262 Reduce repeated storefront catalogue query work

**Status:** Ready. **Product:** Holita.

## Background

Paging or searching the storefront catalogue repeats reads of brands and options, work across the full facet candidate set, and separate count and page reads. A 20-item page limits the response size, while the candidate work grows with the catalogue. The analysis report identified this by code review and did not measure the cost.

## Goal

Measure and reduce the main repeated cost of an ordinary shop catalogue request.

## Steps

1. Capture baseline query plans or timings for the facet, count and page reads on a representative populated shop in a dedicated test database.
2. Optimize the most expensive repeated read identified by the baseline and compare the same query before and after.

## Done when

A repeated search and page change produce the same scoped products, sort order, totals and facet counts, with evidence of less work for the targeted read.

## Limits

Keep the existing public contract and filter semantics. Add an index only if the measured path calls for one. Use the delivery policy if the fix introduces raw SQL.

## References

- [red.bg storefront product read service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontProductReadService.php)
- [Holita catalogue facets](../../holita/apps/commerce/src/products/catalogue.repository.ts#L167)
- [Holita catalogue count and page](../../holita/apps/commerce/src/products/catalogue.repository.ts#L268)
