# 149 Osnova listing override points

**Status:** Ready. **Product:** Osnova (shared by Holita and Discocan).

## Background

At 390 px, Inventory and Products place their row menu on a line of its own. Two different
product names both truncate after “Ароматна свещ”. Badges truncates the long Bulgarian badge
to “МногоДългоИмеМн…”, and Options clips both the option name and value summary. Inventory
clips “Без проследяване” and “Проследява се”, and SKU starts beyond the viewport. The same
table geometry shows up in filtered and loading views.

Badges and Characteristic groups leave a gap after their narrow search fields. Inventory uses
the panel width and places Sort with Filters. TablePanel shows inline feedback for a failed
refresh, but Category and Brand dependency conflicts currently arrive as sticky toasts that
cover mobile page controls.

## Goal

Give Holita listings shared ways to show compact mobile row actions, readable names and badges,
full-width search and inline action feedback. Preserve correct default rendering for every
TablePanel and FilterBuilder consumer.

## Steps

1. Add an opt-in mobile identity layout to the shared responsive table pattern. Place the
   menu in a trailing column beside the identity and mirror that placement in the shared
   TablePanel skeleton. Allow opt-in wrapping for primary names and full badge text,
   including unbroken strings. Keep technical slugs on the smaller secondary line.
2. Opt the affected Holita tables into the layout or wrapping they need. Check Inventory and
   Products menus and long product names, the full Badges label, and long Options names and
   value summaries. In Inventory, use the shared secondary-column breakpoint to hide SKU.
   On mobile, put the full tracking tag below the variant in the identity cell and keep
   quantity in a visible column of its own. Match the loading skeleton to the resulting
   column visibility and row layout.
3. Provide a full-width mobile TablePanel actions slot and FilterBuilder host below the shared
   `sm` breakpoint. Put search on its own row and keep Sort on the controls row where
   supplied. Opt in the affected Holita lists, including Badges and Characteristic groups,
   and use Inventory as the alignment reference.
4. Reuse the shared TablePanel feedback styling to expose opt-in action feedback above
   retained rows. Let the message wrap and be announced without covering controls.
   Keep this independent of the failed-refresh state and its Retry action. Ticket 147
   supplies the Holita-specific Category and Brand conflict messages through this interface.
5. The shared sidebar uses a closed icon set. Add only the missing generic PrimeIcons
   glyphs needed by 147 to its type and renderer so Holita can choose them through its own
   navigation configuration. Preserve all existing icon mappings.

## Done when

At 390 × 844, opted-in Holita menus sit beside names in live and loading rows, the long names
and badges are readable, and Inventory shows quantity and the full tracking tag with SKU
hidden, including when filtered. Badges and Characteristic groups have full-width search.
Where a Sort control is present, it sits on the controls row. With action feedback supplied,
the message wraps above the retained rows and leaves the heading and actions visible.
Without action feedback, panels retain their normal state and spacing.

Changes in `osnova/` reach both products. Run `npm run check` once at handoff and verify it
covers affected projects in Holita and Discocan. Compare representative Holita and Discocan
Admin listings at 390 × 844 and 1440 × 900 in light and dark. Verify that Discocan's existing
look, row actions, skeletons, controls, feedback and sidebar icons do not regress.

## Limits

Use additive override points or fixes whose default rendering stays correct for every
consumer. Holita opts in to the alternate layout. Keep product labels, navigation assignments
and business feedback in Holita. Keep GraphQL, list semantics and shared breakpoints intact.

## References

- [Admin design system](../admin-design-system.md) and [verification](../testing.md)
- [Responsive table patterns](../../osnova/packages/ui/src/styles/_patterns.scss)
- [TablePanel](../../osnova/packages/ui/src/ui/table-panel/table-panel.ts), [template](../../osnova/packages/ui/src/ui/table-panel/table-panel.html) and [styles](../../osnova/packages/ui/src/ui/table-panel/table-panel.scss)
- [FilterBuilder styles](../../osnova/packages/ui/src/ui/filter-builder/filter-builder.scss)
- [Navigation icon type](../../osnova/packages/ui/src/layout/navigation.ts) and [sidebar renderer](../../osnova/packages/ui/src/layout/admin-sidebar.html)
- [Holita Inventory list](../../holita/apps/admin/src/inventory/inventory-page.html) and [column definitions](../../holita/apps/admin/src/inventory/inventory-page.ts)
- [Products](../../holita/apps/admin/src/products/products-page.html), [Badges](../../holita/apps/admin/src/badges/badges-page.html), [Options](../../holita/apps/admin/src/options/options-page.html) and [Characteristic groups](../../holita/apps/admin/src/characteristics/characteristic-groups-page.html)
- [Holita Admin adoption in ticket 147](147-holita-admin-polish.md)
