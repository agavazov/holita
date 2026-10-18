# Admin design system

## Problem

The admin serves two domains (Discocan Fleet and future Ecommerce screens) and must look and
behave as one product. Its presentation was a Sakai-derived layout: a copied layout SCSS tree,
an Aura-compat preset with an emerald primary that fails WCAG AA for white text (2.54:1), a 14 px
root, and per-screen stylesheets that restated colours, spacing, list states, confirmations and
editor layouts. A change of brand colour, density or a list pattern meant editing many screens,
nothing proved that every PrimeNG control matched the theme, and the screens could only be
reviewed against a running backend.

## Why the previous structure could not solve it

- The Sakai layer owned geometry and colours through its own variables and breakpoint (992 px);
  PrimeNG tokens and the layout disagreed, and dark mode needed separate selectors.
- Nothing central described brands or densities: one alternative look would have required a new
  copy of the layout styles and screen styles.
- Screens built their own headers, filters, tables, empty states and editors, so the same state
  (loading, empty, no results, error, retained rows) looked different per screen.

## Decision

- **One theme module.** `apps/admin/src/app/theme/` holds the only visual decisions:
  `holitaPreset(choice)` = `definePreset` over standard Aura with brand ramps, density tokens,
  status tones, component tokens and the `extend.app` tokens (`--p-app-*`). `appTheme` in
  `theme-choice.ts` is the application's single configured choice of brand (`cobalt`, `ember`,
  `pine`) and density (`compact`, `comfortable`). The text, border and status-mark pairs the admin
  relies on are checked for WCAG AA by a unit spec from the Aura primitives (`theme/contrast.ts`).
- **CSS layers and one dark-mode mechanism.** Global styles live in `src/styles/` in the layers
  `holita-reset, primeng, holita`; PrimeNG emits its tokens into `primeng`. Every value that
  differs between schemes is a `light-dark()` token, so `.app-dark` switches PrimeNG and holita
  tokens alike. Breakpoints are declared once in Sass and exposed to TypeScript as `--app-bp-*`.
- **A new shell** (canvas, grouped sidebar with a rail, framed topbar and content) replaces the
  Sakai layout; it reads no business data.
- **Domain-neutral patterns** in `app/ui` (page header, KPI strip, filter builder, table panel
  with row actions, menu button, route drawer, form field, empty state, charts) and helpers (list
  actions and query, URL list state, sequential bulk actions, confirmations, GraphQL field errors,
  validators, formatting, remote options) are the only building blocks of new screens. Single
  PrimeNG controls are used directly, never wrapped.
- **Editing in drawers.** `RouteDrawer` is the editor container: closing a dirty draft with the
  close button, Escape or the backdrop passes through one `confirmLeave` confirmation, and a dirty
  drawer also triggers the browser's leave-page prompt on unload. It closes either through its
  host (`closeRequest`) or, as a child route guarded by `leaveDrawer`, by navigating.
- **Storybook as the review tool.** The patterns, the shell and the states of presentation-only
  example screens have stories on the real Angular components with deterministic fixtures and
  sample data (MenuButton and RowActions only inside the Shell, TablePanel and example stories);
  the application's current Fleet screens are not in Storybook. Brand, density and theme are
  toolbar globals, and stories are English only. `@storybook/addon-vitest` with
  `@vitest/browser-playwright` runs every story, play function and axe check as a test
  (`npm run test:storybook:admin`); these test-tooling dev dependencies were approved for this
  purpose.

## Consequences

- A brand, density, token or pattern change is made once and reaches every screen; Storybook
  shows the alternatives side by side, and changing `appTheme` is the only code change needed to
  switch the application.
- The root font size follows the browser (16 px by default). Karma Client pages and the Fleet
  Vehicles/Devices screens that predate the patterns keep working through
  `styles/_legacy-karma.scss`, the only place the old class names and Sakai variable aliases
  survive; their look is not redesigned and the file is removed once both are gone.
- `light-dark()` and `color-mix()` require current evergreen browsers.
- The application still routes the pre-pattern Fleet Vehicles/Devices screens
  ([Discocan Fleet](../../discocan/fleet.md)); the Fleet views and drawers built from the patterns
  are presentation-only and render only in Storybook. The implemented design system is described
  in [admin design system](../../admin-design-system.md).
