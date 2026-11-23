# 368 Discard unapplied mobile catalogue filters when sorting

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-10 identified this behavior at `1b44cc90`. Closing the filter drawer without applying keeps its draft, which a later change of sort can submit.

## Goal

Discard unapplied mobile catalogue filters when sorting.

## Steps

Separate committed URL filters from unapplied edits when closing the drawer or changing the sort order.

## Done when

After closing an unsubmitted brand selection and changing sort, the URL and results still use only the previously applied filters.

## Limits

Mobile catalogue filter and sort state.

## References

- [catalogue-browse.html](../../holita/apps/storefront/src/catalogue-browse.html#L225)
- [catalogue-browse.html](../../holita/apps/storefront/src/catalogue-browse.html#L300)
- [catalogue-browse.ts](../../holita/apps/storefront/src/catalogue-browse.ts#L206)
