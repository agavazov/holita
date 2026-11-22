# 148 Holita storefront polish

**Status:** Ready after [112](112-holita-storefront-browsing.md). **Product:** Holita.

## Background

Catalogue badges and availability chips pick up Admin colors. A cyan badge and a blue-grey
out-of-stock chip clash with the storefront's green surfaces. At 390 px, an unusually long
Bulgarian badge wraps to about ten narrow lines in a two-column card and leaves a large gap
below the neighboring card. The same badge fits in a wider block on the product detail.

The Account page has a small heading and two inline links. The Sign in submit button has the
same fill and outline as the inputs. The account and registration screens also lack the
catalogue's heading and surface hierarchy. On mobile product detail, the long current-page
crumb wraps onto a line that repeats the H1.

## Goal

Give chips and account screens a consistent storefront hierarchy, keep long badges legible at
mobile widths, and keep the category trail useful on product detail.

## Steps

1. Define storefront `--shop-*` chip tokens for spacing, shape and semantic foreground and
   background pairs in light and dark. Apply them to catalogue and detail availability chips
   and badges. Preserve the named badge color choices and visible stock labels.
2. At the mobile breakpoint, let a catalogue card with an unusually long badge span both grid
   columns and let the full badge text wrap, including unbroken text. Keep ordinary cards in
   the two-column grid and preserve the detail tag's wider wrapping.
3. Use the shop's heading typography on Account, Sign in and Registration. Use a compact
   `--shop-paper` surface for the forms and a shop-token primary action that is distinct
   from editable controls and secondary account links.
4. On mobile product detail, show the full category trail visually and use the H1 as the
   single visible product name. Keep the current-page crumb available to assistive
   technology and keep the full breadcrumb visible on desktop.

## Done when

At 390 × 844, a long Bulgarian badge reads in a full-width card without leaving an empty
half-row beside it, and ordinary cards still render in two columns. The complete badge also
wraps on detail. At 390 × 844 and 1440 × 900 in light and dark, inspect chip styling and stock
labels on catalogue and detail, and verify that the Account, Sign in and Registration headings,
primary actions and secondary links are easy to identify. In Bulgarian and English, check a
long product name, the mobile breadcrumb category links and the accessible current-page crumb.

## Limits

Storefront presentation only. Ticket 112 owns equal-height cards, media layout and photos for
every demo product. Preserve its card and image work while applying the long-badge layout.
Keep existing routes, account behavior and catalogue data.

## References

- [Ticket 112 storefront catalogue browsing](112-holita-storefront-browsing.md)
- [Storefront templates and chip markup](../../holita/apps/storefront/src/main.ts)
- [Storefront tokens, grid, forms and breadcrumbs](../../holita/apps/storefront/src/storefront-page.scss)
