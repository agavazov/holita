# Admin design system: frontend build spec

Pending work for `feature/admin-design-system`. This is the authoritative frontend plan for the
holita admin design system and the Discocan Fleet screens. The backend plan is
[admin-design-system-backend.md](admin-design-system-backend.md); the frontend consumes exactly its
SDL (section 6) and its standard list contract (section 3). The decisions and the open tasks in
order are in [admin-design-system.md](admin-design-system.md); the verified review fixes and their
open decisions are in [admin-design-system-review-fixes.md](admin-design-system-review-fixes.md).

[docs/admin-design-system.md](../admin-design-system.md) is authoritative for the theme, styles,
shell, patterns and Storybook. The first merge stabilizes the implemented scope; backend
integration remains a later phase ([release scope](admin-design-system.md#decisions-agreed-with-the-user)).
Presentational views and drawers for every Fleet screen except the driver scorecard and the
odometer reading exist in `apps/admin/src/app/features/fleet/*`, fed only by story hosts in
`apps/admin/src/storybook/samples/pages`; F2–F5 wire Apollo-backed containers, routes and
operations to those views. Read this file as follows:

- Superseded (background only; the authoritative documents win): 0.4, 1, 2.1, 2.2, 2.4–2.7, 3,
  6.2, 7 (the examples use story-only sample data instead of the GraphQL demo dataset, the
  `Screens/Fleet/*` stories and a Login story) and 10 (applies only when parallel agents run).
- Still the plan: 0.1–0.3, 2.3, 4, 5 (behaviour and operations; file names follow the existing
  views and drawers), 6.1, 6.3, 8 (the F2–F5 specs and smokes), 9, 11 F2–F5 and 12.
- Depends on the open decision "GraphQL fixtures for the Apollo containers or sample hosts"
  ([admin phase](admin-design-system.md#admin-phase-per-screen-f3)): everything in 0.2, 8.1,
  11 F2–F4 and 12 that needs `src/storybook/fleet/*` (demo dataset, store, derived values,
  per-feature handlers, `fixture-coverage.spec.ts`, `demo-dataset.spec.ts`, `derived.spec.ts`
  and the F4 dataset re-sync). None of those artifacts exists; the example pages use
  `src/storybook/samples/fleet-samples.ts`. If the sample hosts stay, these items are dropped.

When the phases in section 11 are done, move the implemented behaviour into the documents listed
in 9.3 and delete this file.

Read [AGENTS.md](../../AGENTS.md), [Discocan instructions](../discocan/instructions.md), the
[admin skill](../../.agents/skills/holita-admin-development/SKILL.md), the official
[angular-developer skill](../../.agents/skills/angular-developer/SKILL.md) and the backend spec
first. Every rule there still applies: standalone Angular, Component → concrete feature service →
Apollo with generated TypedDocumentNodes, typed Reactive Forms, no generic CRUD/facades/duplicate API
models, no `any`, casts or lint suppressions, no new dependencies without the need stated here,
BG/EN catalogs, light/dark, Tenant/Branch isolation, retired reads and captured writes.

## 0. Binding inputs and spikes

### 0.1 User decisions this spec implements

- One centrally controlled admin design system shared by both domains: a central change (token,
  brand, density, pattern) propagates to every screen. Storybook-first review on the real Angular
  components, using the existing `apps/admin/.storybook` and `apps/admin/src/storybook`
  infrastructure (`FixtureHttpBackend`, `graphqlFixture`, `StoryApp`, `prepareStory`). Superseded
  for screens: the example pages use story-only sample hosts without GraphQL.
- The current admin presentation is not a reference. The new visual language takes inspiration
  from Meridian (never its code or assets): neutral zinc-like surfaces, one accent, thin borders,
  almost no shadows, a framed content panel, grouped sidebar with small group labels, compact
  topbar, page header (eyebrow, title, count badge, one-line description, small icon actions),
  KPI strip with thin dividers, filter bar, table panel with heading and count, compact rows
  (~48 px, 13 px text, small uppercase muted headers), tinted status tags, floating bulk bar, drawers.
- PrimeNG 22, `@primeuix/themes` 3 and `@primeicons/angular` only. The application and the
  interactive Storybook read a developer's PrimeUI key from the Git-ignored `config.local.json`;
  without one the "Invalid PrimeUI License" banner shows and is accepted, never hidden.
- Light and dark; Bulgarian and English in the application, English only in Storybook. Three
  switchable brand variants and two densities controlled from one place; the app uses one
  configured choice; Storybook switches them. Primary passes WCAG AA.
- All editing happens in route-driven drawers over a list or detail view (never full pages or
  dialogs).
- Karma Client is temporary: not redesigned, not built on; it must keep working and its tests must
  pass under the new shell.
- Fleet is developed "to the max" as a demo and test bed over one standard list contract.
- Overview is the landing page after login (FND-013 changes). The old Vehicles/Devices screens are
  replaced, not duplicated.
- Work stays on `feature/admin-design-system`; full regression (`test:full`) runs at the end on the
  user's explicit request (section 11, F5).

### 0.2 Scope-review fixes as they land on the frontend

| Review finding                                     | Frontend resolution                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drawer-over-list conflicts with FleetWorkspace     | New nested route tree, drawers as child routes, keyed outlet plus a param-keyed reuse strategy, `ROUTER_OUTLET_DATA` host contract, per-drawer clients (section 4)       |
| MANUAL samples move the data clock                 | The odometer drawer explains that a manual reading changes only the odometer; the UI never derives activity or fuel status itself (5.4, 5.5)                             |
| Duplicates as CONFLICT field errors                | Drawers map `BAD_USER_INPUT` `fieldErrors` to fields; `CONFLICT` is a drawer-level message with Reload; GraphQL fixtures, if chosen, follow the same contract (3.5, 7.2) |
| KPI SDL gaps                                       | Every KPI tile renders `FleetMetric` value, coverage and window; each Overview card is its own operation and fails/retries alone (5.2)                                   |
| Two clocks                                         | Telemetry ages are relative to `asOf`; business dates use `businessDate`; a stale banner compares the wall clock with `asOf` (5.1)                                       |
| No shell badge from business data                  | Navigation has no counts; the Alerts page owns `fleetAlertCounts` (2.3, 5.3)                                                                                             |
| Low fuel defined three ways                        | The UI shows only `FleetVehicleState.fuelStatus`; it never compares `fuelLevelPct` with a threshold (5.4)                                                                |
| Per-row derived resolvers                          | Operations select derived fields only on root lists/details; nested selections use the `…Ref` types (5.0)                                                                |
| Derived sort/filter                                | Lists expose only the filters and sorts of backend 3.6; activity, last report and fuel are display-only columns (5.4)                                                    |
| Preset token list and internal dependencies        | Registered presets are the rendered components plus their PrimeNG dependencies, proven by a coverage story (1.10)                                                        |
| Storybook-only ApolloLink would duplicate fixtures | Keep `FixtureHttpBackend`; the error variants exist (`graphql-fixtures.ts`); per-feature handler modules (7.3) only with GraphQL fixtures                                |
| Storybook dependencies need approval               | Storybook is approved by the user; the exception is recorded in the docs and the admin skill in F4 (9.3)                                                                 |

### 0.3 Verified facts (2026-10-18, worktree `node_modules`)

- `@primeuix/themes` 3.0.1 exports `definePreset`, `updatePreset`, `usePreset`,
  `updatePrimaryPalette`, `updateSurfacePalette`, `useTheme`. `PrimeNG` (primeng 22.1.2) exposes
  `theme: WritableSignal` and `setThemeConfig()`.
- Both `aura` and `aura-compat` base presets in v3 express colour schemes with CSS `light-dark()`
  (no `colorScheme` blocks); `@primeuix/styled` emits `color-scheme: light` for the root and
  `color-scheme: dark` for the `darkModeSelector`. Standard Aura: typography `0.875rem`/`1.5`, form
  field padding `0.375rem 0.625rem`. Compat: `1rem` type at a 14 px root, padding `0.5rem 0.75rem`.
- Standard Aura DataTable tokens include `headerCell.padding`, `columnTitle.fontSize/fontWeight`,
  `bodyCell.padding`, `bodyCell.fontSize`, `row.hoverBackground`; Tag tokens use `orange` for
  `warn` (overridden in 1.6).
- PrimeNG internal imports: Table → checkbox, paginator, select, inputtext, button, badge,
  scroller (plus filter-menu controls this app does not render); Paginator → select, inputnumber;
  Select → inputtext, scroller, tooltip; MultiSelect → checkbox, chip, inputtext, scroller,
  tooltip; AutoComplete → chip, inputtext, scroller; SelectButton → togglebutton; DatePicker →
  button, inputtext; InputNumber → inputtext; Drawer, Dialog → button; ConfirmDialog → dialog,
  button; Button → badge.
- `ROUTER_OUTLET_DATA` and `routerOutletData` exist in `@angular/router` 22.
- The license banner is the element `#p-license-host`.
- Karma pages use the global `.card`, `.page-heading`, `.page-actions`, `.content-link` classes and
  the Sakai aliases `--surface-border`, `--text-color-secondary`; Karma imports PrimeNG button,
  dialog, inputtext, message, select, table. `karma-workspace.ts` uses `AdminWorkspace.session`
  and `.language()`; `karma-workspace.spec.ts` calls `workspace.branches.choose(id, language)`.
- Contrast ratios in this spec were computed with the WCAG 2.x relative-luminance formula from
  the Aura primitive hex values (`@primeuix/themes/aura/base` `primitive`).

### 0.4 Spikes (run first in F0; record results in the task response)

| ID  | Question                                                                                                                                                                      | Accept when                                                                                                                            | Fallback                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Does a `definePreset` over standard Aura with `extend` tokens containing `light-dark()` and `{surface.x}` references emit `--p-app-*` variables that switch with `.app-dark`? | Computed `--p-app-canvas-background` differs between light and dark in a Storybook story                                               | Keep palette/semantic in the preset; declare the colour-valued `app` tokens in `styles/_tokens.scss` as plain CSS `light-dark(var(--p-surface-100), …)` custom props |
| T2  | Can Storybook switch brand/density per story? (a) dynamic `applicationConfig` decorator built from `context.globals`; (b) `provideAppInitializer` + `PrimeNG.theme.set()`     | Switching the toolbar re-renders a page story with the new primary and row height, no stale `<style>` left                             | `usePreset(holitaPreset(choice))` from `@primeuix/themes` in the decorator                                                                                           |
| T3  | `cssLayer: { name: 'primeng', order: 'holita-reset, primeng, holita' }` with global SCSS layers                                                                               | `button { font: inherit }` in `holita-reset` does not override PrimeNG button sizes; `holita` layer rules override PrimeNG rules       | Drop `cssLayer`; scope overrides through preset component `css` only                                                                                                 |
| T4  | Do component SCSS files resolve `@use 'breakpoints'` via `stylePreprocessorOptions.includePaths: ['src/styles']` in both the build and the Storybook targets (issue 36012)?   | `npm run build` and `npm run build:storybook:admin` succeed with a component using the mixin                                           | Relative `@use '../../styles/breakpoints'` paths                                                                                                                     |
| T5  | Keyed `@for` outlet recreation + `ParamKeyedReuseStrategy` + `ROUTER_OUTLET_DATA` callbacks (prototype unit spec with `RouterTestingHarness`)                                 | Branch A→B with `?search=x` issues no A-scoped request after the switch; drawer record change recreates the drawer; host callback runs | Key the drawer outlet by record in the host template instead of the strategy                                                                                         |
| T6  | `@storybook/addon-vitest` 10.6.1 + `@vitest/browser` 5.0.0 + `@vitest/browser-playwright` 5.0.0 run play functions and a11y for angular-vite under WSL                        | `npm run test:storybook:admin` runs one play story and one a11y failure is reported                                                    | Play functions run through a Playwright spec that waits for `data-play-state` (7.6); a11y stays panel-only (`todo`) and is reported as unverified                    |
| T7  | `p-autocomplete` remote search (`completeMethod`, `forceSelection`, object options, `multiple`) and `p-tabs` with `routerLink` tabs                                           | Typed objects round-trip; keyboard selection works; tabs reflect the active child route                                                | `p-select` with `filter`, `(onFilter)` remote search and a label that includes every searched field                                                                  |

## 1. Design tokens and theme

Superseded: the [Theme](../admin-design-system.md#theme) and
[global styles](../admin-design-system.md#global-styles-layers-and-breakpoints) sections of the
design-system document are authoritative.

### 1.1 One theme module

All visual decisions live in `apps/admin/src/app/theme/` and the global stylesheet layers in
`apps/admin/src/styles/`. Nothing else defines colours, radii, shadows, spacing scales or
breakpoints. Component styles use only `var(--p-*)` tokens and the global pattern classes.

| File                                       | Content                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `theme/theme-choice.ts`                    | `ThemeChoice` type and **`appTheme`**, the one configured choice of the application                                           |
| `theme/brands.ts`                          | The three brand variants (1.3)                                                                                                |
| `theme/densities.ts`                       | The two densities (1.4)                                                                                                       |
| `theme/status-tones.ts`                    | Status tone families and the generated Tag/Message/Badge/Button severity tokens (1.6)                                         |
| `theme/holita-preset.ts`                   | `holitaPreset(choice): Preset` = `definePreset(base, brand, density, components, extend, css)`                                |
| `theme/provide-holita-theme.ts`            | `holitaThemeOptions` and `provideHolitaTheme(choice, license?)` returning `providePrimeNG({ ripple: false, theme, license })` |
| `theme/contrast.ts` (+ `contrast.spec.ts`) | `relativeLuminance`, `contrastRatio`, `mixSrgb`, and the AA assertions of 1.3/1.6 over the Aura primitive hex values          |
| `theme/appearance.ts` (+ spec)             | Moved unchanged from `layout/appearance.ts` (light/dark, `holita.admin.theme`)                                                |
| `theme/holita-preset.spec.ts`              | Every brand × density builds; primary steps, density paddings and registered component keys are as specified                  |
| `styles/_breakpoints.scss`                 | The breakpoint map and the `below($name)`/`from($name)` mixins only; emits no CSS (1.9)                                       |
| `styles/_breakpoint-properties.scss`       | The `:root` `--app-bp-*` custom properties generated from the map; used only by `styles.scss` (1.9, 1.12)                     |

`app.config.ts` replaces `providePrimeNG({ … sakaiPreset … })` with
`provideHolitaTheme(appTheme, config.primeUiLicense)`. `layout/sakai-preset.ts` is deleted.

**PrimeUI license (F1, DS).** The tracked `apps/admin/public/config.json` keeps only `graphqlUrl`;
its `primeUiLicense` value is removed from Git. A developer who has a key puts it in the Git-ignored
`apps/admin/public/config.local.json` (`{ "primeUiLicense": "…" }`; `.gitignore` gets
`/apps/admin/public/config.local.json`). `main.ts` loads `/config.json` as today, then
`/config.local.json` with the same timeout: HTTP 404, or a 200 response whose `Content-Type` is not
`application/json` (a server's SPA fallback page), means no local configuration; any other failure,
invalid JSON or a key other than `primeUiLicense` is the existing configuration error. (The smoke
fixture `angular-fixture.mts` already answers 404 for missing non-HTML files.)
`readLocalAdminConfig(value)` in `core/config/admin-config.ts` validates it (string, trimmed, empty
ignored) and `main.ts` merges it over the public configuration before `appConfig(config)`.
`readAdminConfig` keeps accepting `primeUiLicense` so a deployment may still serve it in
`config.json`. `docs/development.md` documents the file without any value; `.env.example` is
unchanged (no environment variable). Without a key the "Invalid PrimeUI License" banner shows
(accepted, as in Storybook). Rotating the key that remains in Git history is left to the user.

```ts
// theme/theme-choice.ts
export type BrandName = 'cobalt' | 'ember' | 'pine';
export type DensityName = 'compact' | 'comfortable';
export interface ThemeChoice {
  readonly brand: BrandName;
  readonly density: DensityName;
}
/** The application's single configured design choice. Change it here only. */
export const appTheme: ThemeChoice = { brand: 'cobalt', density: 'compact' };
```

### 1.2 Base preset and root font size

Decision: **standard Aura** (`@primeuix/themes/aura/*`) with the **browser default 16 px root**
(`html { font-size: 100% }`; the Sakai `14px` rule is deleted).

- `aura-compat` exists to keep a 14 px-root app looking right and is a migration bridge; the
  standard preset is the maintained target of `@primeuix/themes` 3.
- At a 16 px root, standard Aura already renders 14 px body/control text and compact paddings,
  which is the Meridian density; compat at 14 px produces the same pixels with larger rem values
  and fights every rem-based token we add.
- A 100 % root honours the user's browser font-size setting (WCAG 1.4.4 resize text).
- Consequence: every rem value in Karma's CSS grows by about 14 %. Karma is behaviourally tested
  and keeps working; its look is out of scope.

### 1.3 Brand variants (primary and neutral ramps)

A brand names one Aura primitive palette for `primary`, one for the neutral `surface` ramp and the
primary steps used in light and dark. Ramps reference primitives (`{blue.600}`), never hex copies.

| Brand              | Primary palette | Neutral (surface) | Light `primary.color` / hover / active | Dark `primary.color` / hover / active | Character                                   |
| ------------------ | --------------- | ----------------- | -------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `cobalt` (default) | `blue`          | `slate`           | 600 / 700 / 800                        | 400 / 300 / 200                       | Cool, neutral; does not collide with `warn` |
| `ember`            | `orange`        | `zinc`            | 700 / 800 / 900                        | 400 / 300 / 200                       | Closest to Meridian (orange accent on zinc) |
| `pine`             | `teal`          | `stone`           | 700 / 800 / 900                        | 400 / 300 / 200                       | Warm neutrals, calm accent                  |

`cobalt` is the configured default because an orange primary sits next to amber `warn` and red
`danger` tags on every Fleet screen and weakens their meaning; `ember` stays available for review.

Computed AA checks (WCAG 2.x; 4.5:1 for text, 3:1 for focus indicators):

| Brand                               | White on primary (light) | White on hover | Primary text on surface 0 / 50 / 100 | Selected-row text (`primary.700`/`800` on `primary.50`) | Dark: primary on surface 900 / 950 | Dark: surface 950 on primary / hover |
| ----------------------------------- | ------------------------ | -------------- | ------------------------------------ | ------------------------------------------------------- | ---------------------------------- | ------------------------------------ |
| `cobalt`                            | 5.17                     | 6.70           | 5.17 / 4.94 / 4.72                   | 6.16 (700 on 50)                                        | 7.02 / 7.93                        | 7.93 / 11.19                         |
| `ember`                             | 5.18                     | 7.31           | 5.18 / 4.96 / 4.71                   | 6.88 (800 on 50)                                        | 7.83 / 8.79                        | 8.79 / 11.80                         |
| `pine`                              | 5.47                     | 7.58           | 5.47 / 5.24 / 5.02                   | 7.27 (800 on 50)                                        | 9.39 / 10.61                       | 10.61 / 13.35                        |
| current Aura emerald-500 (rejected) | 2.54                     | 3.77           | 2.54                                 | —                                                       | —                                  | —                                    |

Semantic mapping per brand (`brandSemantic(brand)` in `holita-preset.ts`):

```ts
primary: {
  50: '{blue.50}', …, 950: '{blue.950}',              // the brand palette, all 11 steps
  color: 'light-dark({primary.600}, {primary.400})',   // steps from the table above
  contrastColor: 'light-dark(#ffffff, {surface.950})',
  hoverColor: 'light-dark({primary.700}, {primary.300})',
  activeColor: 'light-dark({primary.800}, {primary.200})',
},
surface: { 0: '#ffffff', 50: '{slate.50}', …, 950: '{slate.950}' }, // same steps in both schemes
highlight: { color: 'light-dark({primary.700}, rgba(255,255,255,.87))' } // 800 for ember/pine
```

Aura's base maps `surface` to slate in light and zinc in dark; holita uses one neutral per brand in
both schemes, so the brand's grey character is stable across themes.

### 1.4 Densities

| Token (where)                                                  | `compact` (default, Meridian) | `comfortable`     |
| -------------------------------------------------------------- | ----------------------------- | ----------------- |
| `semantic.formField.paddingY` / `paddingX`                     | 0.375rem / 0.625rem           | 0.5rem / 0.75rem  |
| `semantic.list.option.padding`                                 | 0.375rem 0.625rem             | 0.5rem 0.75rem    |
| `components.button.root.paddingY` / `paddingX`                 | 0.375rem / 0.75rem            | 0.5rem / 0.875rem |
| `components.datatable.headerCell.padding`                      | 0.5rem 0.75rem                | 0.625rem 1rem     |
| `components.datatable.bodyCell.padding`                        | 0.375rem 0.75rem              | 0.625rem 1rem     |
| `components.datatable.bodyCell.fontSize`                       | 0.8125rem (13 px)             | 0.875rem (14 px)  |
| `components.datatable.columnTitle.fontSize` (uppercase, 600)   | 0.6875rem (11 px)             | 0.75rem (12 px)   |
| `components.drawer.content.padding`                            | 0 1.25rem 1.25rem             | 0 1.5rem 1.5rem   |
| `extend.app.row.height` (table row minimum)                    | 3rem (48 px)                  | 3.5rem (56 px)    |
| `extend.app.control.height` (target for inputs/buttons, ±1 px) | 2.125rem (34 px)              | 2.5rem (40 px)    |
| `extend.app.topbar.height`                                     | 3.25rem (52 px)               | 3.5rem (56 px)    |
| `extend.app.gutter` (page padding from `md`)                   | 1.25rem                       | 1.5rem            |
| `extend.app.panel.padding`                                     | 1rem                          | 1.25rem           |
| `extend.app.stack.gap` (vertical gap between page blocks)      | 1rem                          | 1.25rem           |
| `extend.app.text.title` (page h1)                              | 1.375rem                      | 1.5rem            |

The DS story "Spacing and density" measures a `pInputText`, a `pButton`, a `p-select` and a table
row and fails its play function when a height differs from `control.height`/`row.height` by more
than 1 px; adjust the paddings above, not the targets.

### 1.5 Typography, spacing, radii, borders, shadows (`extend.app`)

| Group      | Tokens                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Font       | `font.family`: `'Lato', system-ui, -apple-system, 'Segoe UI', sans-serif` (local Lato 400/500/600/700/800 stays the brand font); `font.numeric`: `tabular-nums` (applied by `.app-num`)                                                                                                                                                   |
| Text sizes | `text.xs` 0.6875rem (eyebrow, group labels, column titles; uppercase, 600, `letter-spacing: .06em`); `text.sm` 0.75rem (meta, hints, tags); `text.table` = density; `text.base` 0.875rem (body, controls); `text.md` 1rem (h3); `text.lg` 1.125rem (h2, drawer title); `text.title` = density (h1); `text.kpi` 1.625rem (KPI values, 600) |
| Line       | Body 1.5 (Aura), headings 1.25 (`h1–h3` in `styles/_base.scss`)                                                                                                                                                                                                                                                                           |
| Space      | `space.1` 0.25rem, `2` 0.5rem, `3` 0.75rem, `4` 1rem, `5` 1.25rem, `6` 1.5rem, `8` 2rem, `10` 2.5rem                                                                                                                                                                                                                                      |
| Radii      | `radius.frame` `{border.radius.xl}` (12 px), `radius.panel` `{border.radius.lg}` (8 px), `radius.control` `{border.radius.md}` (6 px, Aura form fields), `radius.tag` `{border.radius.sm}` (4 px); `semantic.content.borderRadius` = `{border.radius.lg}`                                                                                 |
| Borders    | 1 px everywhere. `semantic.content.borderColor`: `light-dark({surface.200}, {surface.800})` (decorative dividers). Form field border (component boundary, WCAG 1.4.11): `light-dark(color-mix(in srgb, {surface.500}, {surface.400}), {surface.500})`, hover `light-dark({surface.500}, {surface.400})`                                   |
| Shadows    | Panels, frame, KPI strip and table: none. Overlays keep Aura's `overlay.*.shadow`. `shadow.floating` `0 8px 24px -8px rgb(0 0 0 / .2), 0 2px 6px -2px rgb(0 0 0 / .08)` only for the bulk bar and the drawer edge                                                                                                                         |
| Focus      | `semantic.focusRing`: width `2px`, style `solid`, colour `{primary.color}`, offset `2px`, shadow `none` (≥ 4.94:1 against surface 0/50 in every brand)                                                                                                                                                                                    |
| Motion     | `semantic.transitionDuration` `0.15s`; the global reduced-motion rule stays                                                                                                                                                                                                                                                               |

Form field border contrast (light, mix of 500 and 400): slate 3.46 / 3.31, zinc 3.47 / 3.32,
stone 3.41 / 3.26 against surface 0 / 50; dark (500): slate 4.24 / 3.75, zinc 4.12 / 3.67,
stone 4.12 / 3.65 against surface 950 / 900. Text: `text.color` (700) ≥ 10.27, `text.mutedColor`
(500) on surface 0 ≥ 4.76 and on surface 50 ≥ 4.55; dark muted (400) on 900 ≥ 6.91.

**Canvas rule:** muted 500 on surface 100 is only 4.34–4.40 and fails. The canvas (surface 100)
therefore uses `canvas.mutedColor` = `light-dark({surface.600}, {surface.400})` (≥ 6.92); table
headers and panel headers use surface 50, never 100.

### 1.6 Status tones and categorical palette

`theme/status-tones.ts` declares the families once:

```ts
export const statusTones = { success: 'green', info: 'sky', warn: 'amber', danger: 'red' } as const;
export type StatusTone = keyof typeof statusTones | 'neutral' | 'accent';
```

From it the preset generates:

| Token                                           | Light                                                                     | Dark                                                                      | AA                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `app.tone.<t>.color` and Tag `<severity>.color` | `{family.800}`                                                            | `{family.200}`                                                            | 800 on 100: green 6.49, sky 6.59, amber 6.37, red 6.80   |
| `app.tone.<t>.background` and Tag background    | `{family.100}`                                                            | `color-mix(in srgb, {family.400}, transparent 84%)`                       | dark 200 on tint over surface 900: ≥ 9.67                |
| `app.tone.<t>.solid` (dots, bars, markers)      | `{family.600}`                                                            | `{family.400}`                                                            | non-text ≥ 3: green 3.30, amber 3.19, sky 4.10, red 4.83 |
| Message `<severity>.color` / border             | `{family.700}` / `{family.200}`                                           | `{family.300}` / `color-mix(in srgb, {family.700}, transparent 64%)`      | 700 on 50: ≥ 4.79                                        |
| Button `danger` / `warn` / `success` / `info`   | `{red.600}` / `{amber.700}` / `{green.700}` / `{sky.700}` with white text | 400 steps with surface 950 text                                           | white on: 4.83 / 5.02 / 5.02 / 5.93                      |
| `neutral`                                       | colour `{surface.700}`, background `{surface.100}`, solid `{surface.500}` | colour `{surface.200}`, background `{surface.800}`, solid `{surface.400}` | 9.50 / 10.08                                             |
| `accent`                                        | Tag `primary` tokens (`primary.700/800` on `primary.100`)                 | `primary.300` on primary tint                                             | covered by the brand table                               |

`app/ui/tones.ts` maps `StatusTone` to PrimeNG Tag severities (`neutral` → `secondary`,
`accent` → none/`primary`). Every component that shows a status uses `p-tag` with a severity from
this map; there is no StatusTag wrapper (3.1).

Categorical palette for vehicle groups (`FleetGroupColor C1–C8`) and chart series
(`app.category.c1…c8`, light `600`/`700` step vs white, dark `400` vs surface 900):

| Slot | Light (ratio vs white) | Dark (ratio vs 900) |
| ---- | ---------------------- | ------------------- |
| C1   | blue 600 (5.17)        | blue 400 (6.97)     |
| C2   | teal 600 (3.74)        | teal 400 (9.52)     |
| C3   | amber 600 (3.19)       | amber 400 (10.61)   |
| C4   | violet 600 (5.70)      | violet 400 (6.51)   |
| C5   | rose 600 (4.70)        | rose 400 (6.58)     |
| C6   | lime 700 (4.99)        | lime 400 (11.75)    |
| C7   | cyan 700 (5.36)        | cyan 400 (9.80)     |
| C8   | fuchsia 600 (4.71)     | fuchsia 400 (7.20)  |

Colour is never the only carrier: group dots sit next to the group name; chart segments have
labels and a visually hidden data table.

### 1.7 App layout tokens (`extend.app`, emitted as `--p-app-*`)

| Token                          | Value                                                                                                                                                                                     | Use                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `canvas.background`            | `light-dark({surface.100}, {surface.950})`                                                                                                                                                | Page behind sidebar and frame                              |
| `canvas.mutedColor`            | `light-dark({surface.600}, {surface.400})`                                                                                                                                                | Group labels, tenant line, login description on the canvas |
| `frame.background`             | `light-dark({surface.0}, {surface.900})`                                                                                                                                                  | Framed content panel (contains topbar and page)            |
| `frame.borderColor`            | `{content.border.color}`                                                                                                                                                                  |                                                            |
| `frame.gap`                    | `0.5rem` (tokens are static; `styles/_shell.scss` uses `0` below `lg`)                                                                                                                    | Margin around the frame (top/right/bottom)                 |
| `frame.radius`                 | `{app.radius.frame}` (`0` below `lg`, set by the shell SCSS)                                                                                                                              |                                                            |
| `sidebar.width`                | `15.5rem` (248 px)                                                                                                                                                                        | Desktop sidebar and mobile navigation drawer               |
| `sidebar.railWidth`            | `4rem` (64 px)                                                                                                                                                                            | Collapsed desktop rail                                     |
| `sidebar.item.*`               | color `{text.color}`, hover background `light-dark({surface.200}, {surface.800})`, active background `{app.frame.background}`, active indicator `{primary.color}` (3 px inline-start bar) | Navigation items on the canvas                             |
| `topbar.height`                | density                                                                                                                                                                                   | Sticky topbar inside the frame                             |
| `content.maxWidth`             | `100rem` (1600 px)                                                                                                                                                                        | Page content cap inside the frame                          |
| `gutter`, `gutterNarrow`       | density / `1rem` (the shell SCSS switches to `gutterNarrow` below `md`)                                                                                                                   | Page side padding (16 px phone gutter)                     |
| `panel.*`                      | background `{content.background}`, border `{content.border.color}`, header background `light-dark({surface.50}, {surface.900})`, padding density, radius `{app.radius.panel}`             | Table panels, cards, KPI strip                             |
| `stack.gap`                    | density                                                                                                                                                                                   | Gap between page blocks                                    |
| `control.height`, `row.height` | density                                                                                                                                                                                   | 1.4                                                        |
| `drawer.width.md` / `lg`       | `35rem` (560 px) / `45rem` (720 px); `100vw` below `md`                                                                                                                                   | Route drawers                                              |
| `kpi.minWidth`                 | `10.5rem`                                                                                                                                                                                 | KPI tile minimum width                                     |
| `shadow.floating`              | 1.5                                                                                                                                                                                       | Bulk bar, drawer edge                                      |

### 1.8 Dark mode

- `Appearance` (moved to `theme/`) toggles `.app-dark` and `style.colorScheme` on `<html>` and
  persists `holita.admin.theme` exactly as today (behaviour and spec unchanged; default light).
- `holitaThemeOptions.darkModeSelector = '.app-dark'`. Every theme value that differs between
  schemes is written as `light-dark(light, dark)` in the preset, like Aura v3 itself; PrimeNG emits
  `color-scheme` for `:root` and `.app-dark`, so one mechanism drives PrimeNG and app tokens.
- Global and component SCSS never contain `.app-dark` selectors or literal colours. ESLint cannot
  check SCSS, so the rule is enforced in review (DS skill checklist) and made visible by the DS
  story "Foundations/Colors", which renders every `--p-app-*` colour in both schemes, and by the
  a11y gate (7.6).

### 1.9 Breakpoints (single source)

`styles/_breakpoints.scss` is the only declaration of the values (`@use 'sass:map'`). It contains
the map and the mixins and emits no CSS, so every component stylesheet may `@use 'breakpoints'`
without copying anything into its output (Angular compiles each component stylesheet separately and
Sass emits a used module's CSS in each compilation; component budgets are 4 kB):

```scss
$breakpoints: (
  sm: 640px,
  md: 768px,
  lg: 1024px,
  xl: 1280px,
  xxl: 1536px,
);
@mixin below($name) {
  @media (max-width: calc(#{map.get($breakpoints, $name)} - 0.02px)) {
    @content;
  }
}
@mixin from($name) {
  @media (min-width: map.get($breakpoints, $name)) {
    @content;
  }
}
```

`styles/_breakpoint-properties.scss` is used only by `styles.scss` and emits the custom properties
once, generated from the map:

```scss
@use 'sass:map';
@use 'breakpoints';
:root {
  @each $name, $value in breakpoints.$breakpoints {
    --app-bp-#{$name}: #{$value};
  }
}
```

TypeScript application code never hard-codes a breakpoint: `app/ui/media.ts` reads `--app-bp-<name>`
from `getComputedStyle(document.documentElement)` once and returns `Signal<boolean>` for
`below('lg')`-style queries via `matchMedia` (throws `Error('Global styles are not loaded')` when the
property is missing). The shell smoke proves CSS and TypeScript switch at the same pixel (8.2).

**Unit-test environment (F1, DS).** `ng test` runs in jsdom 30, which has no `window.matchMedia`
and does not load `styles.scss`, while every spec that starts a demo session renders
`AdminWorkspace` → `AdminShell` → `below('lg')` (including the Karma specs that must stay
unchanged). `apps/admin/src/test-setup.ts` is therefore added to the `test` target as
`"setupFiles": ["src/test-setup.ts"]` in `apps/admin/angular.json`, included in
`tsconfig.spec.json` and excluded from `tsconfig.app.json`. It:

- appends one `<style>` element with `:root { --app-bp-sm: 640px; … --app-bp-xxl: 1536px }` (the
  only restatement of the values, test-only; jsdom resolves custom properties from style sheets
  and inline styles through `getComputedStyle`, verified 2026-10-18);
- installs a deterministic `window.matchMedia` that evaluates `(max-width: <n>px)` and
  `(min-width: <n>px)` against `window.innerWidth` (jsdom default 1024, so the desktop layout),
  returns a `MediaQueryList` with `matches`, `media`, `addEventListener`/`removeEventListener`
  (`change`) and the legacy `addListener`/`removeListener`, and re-evaluates and notifies
  listeners on window `resize`. Specs switch layouts with
  `Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })` plus
  `window.dispatchEvent(new Event('resize'))`.

`media.spec.ts` covers the missing-property error by removing the setup `<style>` for one case.

| Breakpoint | Behaviour                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `< sm`     | One-row topbar without breadcrumb; filter controls collapse behind "Filters"; KPI strip 2 columns; Alerts list as cards |
| `< md`     | Drawers full width; gutter 1 rem; card grids 1 column; secondary table columns hidden (`.app-col-secondary`)            |
| `< lg`     | Sidebar becomes the navigation drawer; frame becomes full-bleed (no gap, radius, border)                                |
| `md…xl`    | Card grids 2 columns                                                                                                    |
| `≥ xl`     | Card grids 3 columns                                                                                                    |

### 1.10 Registered PrimeNG component presets

`holitaPreset` imports `@primeuix/themes/aura/base` and exactly these component presets (rendered
components plus their rendered internal dependencies). Adding a PrimeNG control means adding its
preset and dependencies here and to the "PrimeNG coverage" story in the same change.

| Preset            | Rendered by                                                 | Internal dependency of                                     |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| `autocomplete`    | Vehicle/driver pickers in drawers and filters               |                                                            |
| `avatar`          | Driver initials                                             |                                                            |
| `badge`           | Open-alert counts, tab badge                                | button                                                     |
| `button`          | Everywhere, Karma                                           | drawer, dialog, datepicker                                 |
| `checkbox`        | Table selection                                             | datatable, multiselect                                     |
| `chip`            | Selected values in multiselect/autocomplete, device options | multiselect, autocomplete                                  |
| `confirmdialog`   | Destructive confirmations, discard confirmation             |                                                            |
| `datatable`       | Every list, Karma                                           |                                                            |
| `datepicker`      | Date filters and date/datetime fields                       |                                                            |
| `dialog`          | Karma detail dialogs                                        | confirmdialog                                              |
| `drawer`          | Route drawers, mobile navigation                            |                                                            |
| `iconfield`       | Search inputs                                               |                                                            |
| `inputnumber`     | Numeric fields                                              | paginator                                                  |
| `inputtext`       | Text fields, Karma                                          | select, multiselect, autocomplete, datepicker, inputnumber |
| `message`         | Inline errors and banners, Karma                            |                                                            |
| `metergroup`      | Overview activity                                           |                                                            |
| `multiselect`     | Enum filters                                                |                                                            |
| `paginator`       | TablePanel footer                                           |                                                            |
| `popover`         | KPI explanations                                            |                                                            |
| `progressbar`     | Refresh indicator                                           |                                                            |
| `select`          | Branch switcher, form selects, paginator rows, Karma        | paginator                                                  |
| `selectbutton`    | Segments and period presets, colour slot picker             |                                                            |
| `skeleton`        | Loading states                                              |                                                            |
| `tabs`            | Vehicle detail                                              |                                                            |
| `tag`             | Statuses                                                    |                                                            |
| `textarea`        | Notes, remark                                               |                                                            |
| `timeline`        | Alert and trip timelines, service history                   |                                                            |
| `togglebutton`    |                                                             | selectbutton                                               |
| `toggleswitch`    | Boolean filters, "schedule next"                            |                                                            |
| `tooltip`         | Rail labels, truncated text, absolute times                 | select, multiselect                                        |
| `virtualscroller` | Option overlays                                             | select, multiselect, autocomplete                          |

Removed from the current preset: `listbox` (RelationPicker retired; Karma does not use it),
`radiobutton` (not rendered), `ripple` (`ripple: false`). Preset-level `css` (central, not per
component file) adds: uppercase/letter-spaced DataTable column titles, `font-variant-numeric:
tabular-nums` for `.app-num` cells, the `row.height` minimum on body rows, and the tab-bar
alignment used by the vehicle detail.

### 1.11 Storybook switching

- `.storybook/preview.ts` adds toolbar globals `brand` (`cobalt`/`ember`/`pine`, titles
  "Cobalt · blue/slate", …) and `density` (`compact`/`comfortable`), with `initialGlobals` taken
  from `appTheme`, and keeps `theme` and `locale`.
- `storybookApplicationConfig(choice)` builds the providers with `provideHolitaTheme(choice)` (the
  story clock comes from `prepareStory`, 7.1); the
  preview decorator passes `{ brand: globals.brand, density: globals.density }` (T2 decides between
  the dynamic decorator and `PrimeNG.theme.set`). The app never reads Storybook globals.
- The DS story "Brand variants" shows the three ramps as static swatches with the 1.3 ratios computed
  live by `theme/contrast.ts`, so all three can be compared without switching.

### 1.12 Global stylesheet structure

`apps/admin/src/styles.scss` becomes:

```scss
@use 'styles/layers'; // only `@layer holita-reset, primeng, holita;` (Sass requires @use first)
@use 'styles/fonts'; // Lato @font-face (moved from sakai/_fonts.scss)
@use 'styles/breakpoint-properties'; // --app-bp-* once (the mixin module itself emits nothing)
@use 'styles/reset'; // @layer holita-reset: box-sizing, font inheritance, tap highlight
@use 'styles/base'; // @layer holita: html/body, canvas, headings, links, focus, skip link, reduced motion, .app-visually-hidden
@use 'styles/shell'; // @layer holita: frame, sidebar, topbar, rail, mobile rows (2.2)
@use 'styles/patterns'; // @layer holita: .app-facts, .app-form-section, .app-form-grid, .app-card, .app-card-grid, .app-dot, .app-num, .app-mono, .app-cell-stack, .app-meter, .app-drawer-actions, .app-col-secondary, .app-timeline-event
@use 'styles/legacy-karma'; // @layer holita: .card, .page-heading, .page-actions, .content-link and the Sakai aliases Karma CSS reads
```

`styles/legacy-karma.scss` is the only place the old class names and the aliases
`--surface-border`, `--surface-card`, `--text-color`, `--text-color-secondary`, `--primary-color`,
`--content-border-radius` survive, mapped to the new tokens. Fleet, shell and DS code must not use
them (review rule in the DS skill). It is deleted when Karma is retired (backlog entry, 9.4).

## 2. Shell

Superseded except 2.3: the [Shell section](../admin-design-system.md#shell) of the design-system
document is authoritative.

### 2.1 Components (rewritten in `app/layout/`)

The Sakai-derived shell is replaced, keeping the class name `AdminShell` and selector
`holita-admin-shell` so existing Karma and workspace specs keep their references.

| File                            | Responsibility                                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout/admin-shell.ts/.html`   | Frame layout, skip link, desktop/mobile switching (`below('lg')`), mobile navigation drawer, rail state, focus management, theme-persistence warning, projected `<main>` content |
| `layout/admin-sidebar.ts`       | Logo link, grouped navigation from `NavGroup[]`, rail rendering, tenant line                                                                                                     |
| `layout/admin-topbar.ts`        | Menu/rail toggle, breadcrumb, Branch, language, notifications and account menus (theme, sign-out)                                                                                |
| `layout/navigation.ts`          | `NavGroup`, `NavItem`, `NavIconName` types (domain-neutral)                                                                                                                      |
| `workspace/admin-navigation.ts` | `adminNavigation(language, branchId, fleetEnabled): NavGroup[]` composing `fleetNavigation()` (F2) and the Karma group (labels from the app catalog)                             |
| `layout/admin-navigation.ts`    | Deleted (replaced by the sidebar)                                                                                                                                                |

`AdminShell` inputs and outputs are described in the
[design-system Shell section](../admin-design-system.md#shell) (the topbar menus replaced the
Branch select, language link and theme toggle planned here); public `chooseBranch(value)` stays
(used by existing specs). `fleetEnabled` moves out of the shell into `adminNavigation`. The shell imports no
feature code and reads no business data; navigation has no counts or badges.

```ts
export type NavIconName =
  | 'th-large'
  | 'bell'
  | 'directions'
  | 'truck'
  | 'id-card'
  | 'mobile'
  | 'wrench'
  | 'tags'
  | 'car'
  | 'users'
  | 'shield'
  | 'folder'
  | 'clock'
  | 'info-circle';
export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: NavIconName;
  readonly link: readonly string[];
}
export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly note?: string;
  readonly items: readonly NavItem[];
}
```

The sidebar maps `NavIconName` to `@primeicons/angular` components with one `@switch` (a closed,
named-by-icon set; no dynamic component loading).

### 2.2 Layout and geometry

```text
≥ lg (1024)                                              < lg
┌──────────────┬──────────────────────────────────────┐  ┌──────────────────────────────┐
│ holita       │┌────────────────────────────────────┐│  │ ☰ h [Клон▾] [BG▾] (!) (ЕП)   │  sticky topbar
│              ││ ☰ … › Аларми [Клон▾] [BG▾] (!) (ЕП)││  │ (one row at every width)     │
│ НАБЛЮДЕНИЕ   │├────────────────────────────────────┤│  ├──────────────────────────────┤
│  ▣ Преглед   ││ page content (max 1600, gutter)    ││  │ page content (gutter 16 px)  │
│  ▣ Аларми    ││                                    ││  │                              │
│ АВТОПАРК …   ││                                    ││  │                              │
│ tenant line  │└────────────────────────────────────┘│  └──────────────────────────────┘
└──────────────┴──────────────────────────────────────┘  navigation in a left p-drawer
canvas  sidebar 248 / rail 64   frame (gap 8, radius 12, 1 px border)
```

- The document scrolls (not the frame), so full-page screenshots capture everything. Sidebar:
  `position: sticky; top: 0; height: 100dvh; overflow-y: auto` on the canvas. Frame:
  `min-height: calc(100dvh - 2 × frame.gap)`. Topbar: `position: sticky; top: frame.gap` inside the
  frame with the frame background and a bottom border.
- Page content: `max-width: content.maxWidth`, centred, padding `gutter`; blocks separated by
  `stack.gap`.
- Rail (desktop collapse): sidebar becomes `railWidth`; labels stay in the DOM as
  `.app-visually-hidden` text so links keep accessible names; `pTooltip` (right) shows the label on
  hover/focus; group labels become separators with visually hidden headings. The rail choice
  persists in `localStorage` key `holita.admin.sidebar` (`rail` | `full`) inside try/catch; storage
  failure only loses the preference.
- The topbar is one row of `holita-menu-button` menus at every width, so drafts and the open
  state survive resizing (replaces the template-outlet move).
- Logo: link with accessible name `holita` to `['/', language, branchId, 'fleet']` (or
  `['/', language]` without a Branch), in the sidebar header from `lg` and in the topbar below.
- Tenant line: muted `holita · <tenant>` at the bottom of the sidebar (replaces the footer).
- Karma group: label "Karma Client" plus a separate small `note` tag "временно"/"temporary".

### 2.3 Navigation model

| Group (bg / en)          | Item (bg / en)                           | Icon         | Link (under `/:language/:branchId`) |
| ------------------------ | ---------------------------------------- | ------------ | ----------------------------------- |
| Наблюдение / Monitoring  | Преглед / Overview                       | `th-large`   | `fleet/overview`                    |
|                          | Аларми / Alerts                          | `bell`       | `fleet/alerts`                      |
|                          | Курсове / Trip log                       | `directions` | `fleet/trips`                       |
| Автопарк / Fleet         | Превозни средства / Vehicles             | `truck`      | `fleet/vehicles`                    |
|                          | Шофьори / Drivers                        | `id-card`    | `fleet/drivers`                     |
|                          | Устройства / Devices                     | `mobile`     | `fleet/devices`                     |
| Поддръжка / Service      | Обслужване / Maintenance                 | `wrench`     | `fleet/maintenance`                 |
| Настройки / Settings     | Групи превозни средства / Vehicle groups | `tags`       | `fleet/settings/groups`             |
| Karma Client (temporary) | existing six items, labels unchanged     | existing     | `/:language/karma-client/…`         |

Fleet groups appear only when `fleetEnabled` and a Branch is selected (FND-016 unchanged). Links use
`routerLinkActive` with `ariaCurrentWhenActive="page"`; a detail page (`vehicles/:vehicleId`)
activates its list item. Until F2, `adminNavigation` lists only the existing Vehicles/Devices items.
The Storybook example navigation (`src/storybook/samples/example-app.ts`) uses "Trips" and adds
Settings › General, which has no backend; production follows this table.

**Name collision rule.** The Fleet groups are also rendered on Karma pages (the browser fixture's
session has a Branch and `fleetEnabled` is true), and the Karma smokes click unscoped links by exact
name, e.g. `angular-karma-phase3.smoke.spec.mts` runs
`page.getByRole('link', { name: 'Trips', exact: true })` on `/en/karma-client/cars/41`. A Fleet
item named "Trips" would make that locator match two links (Playwright strict mode). The English
Fleet label is therefore "Trip log" (page title too; Bulgarian stays "Курсове"), and
`features/fleet/fleet-navigation.spec.ts` (S, F2) asserts that no Fleet group or item label in
either language equals a Karma navigation label or one of the Karma in-page link names the Karma
smokes use: `Trips`, `Location`, `eData`, `Roles`, `Роли`, `Time zones`, `Към камиона`,
`Към камионите`, `Информация за API`, `Open map (new tab)`. The Karma smokes stay unchanged.

### 2.4 Topbar page context and document title

`AdminWorkspace` computes `context` as the navigation item whose link is the longest prefix of the
current URL path (group label › item label, plus the record name a record page registers with
`injectPageRecord`; see the [design-system Shell section](../admin-design-system.md#shell)) and
passes it to the shell. An effect sets `document.title` to `<page> · holita` (`holita` when
there is no context; `Вход · holita` / `Sign in · holita` on Login). `index.html` keeps a static
fallback `<title>holita</title>`.

### 2.5 Accessibility and focus

- Skip link `#main-content` first in the tab order; `<header>` (banner), `<aside>` (complementary,
  labelled "Навигация"/"Navigation") with `<nav>` inside, `<main id="main-content" tabindex="-1">`.
- Mobile navigation: `p-drawer` (modal, `blockScroll`, Escape, backdrop) labelled "Navigation",
  close button `#mobile-navigation-close` receives focus on show; closing returns focus to the menu
  button; it closes on `NavigationEnd` and when the viewport reaches `lg` (no stuck
  `p-overflow-hidden`).
- Page changes: on `NavigationEnd` where the page key (route config chain without routes flagged
  `drawer: true` or `tab: true`) changed and the navigation was not the initial one, the shell focuses
  `#page-title` (the PageHeader h1, `tabindex="-1"`) or `#main-content` when absent. Drawer routes
  manage their own focus (3.3, 4.4).
- Every icon-only control has an accessible name from the catalog; decorative SVGs are
  `aria-hidden`. Visible focus uses the 2 px focus ring in both themes.
- `AdminWorkspace` extends `PrimeNG.setTranslation` with BG/EN DatePicker texts (`dayNames`,
  `dayNamesShort`, `dayNamesMin`, `monthNames`, `monthNamesShort`, `firstDayOfWeek: 1`,
  `dateFormat: 'dd.mm.yy'`, `today`, `clear`, `weekHeader`), MultiSelect/AutoComplete
  `emptyMessage`/`emptySearchMessage`/`searchMessage`/`selectionMessage`, plus the existing aria
  labels.

### 2.6 Behaviours kept from the current shell

Persisted theme, language switch preserving path/query/hash, sign-out through the dirty guard
(`AdminWorkspace.logout`), the Branch menu showing the active Branch after canceled navigation,
disabled Branch menu while discovery loads, theme-persistence warning, no horizontal page scroll at any
width from 320 px, `aside` landmark with Fleet/Karma links (Karma smokes rely on
`page.locator('aside').getByRole('link', …)`).

### 2.7 Login

`features/auth/login.*` keeps its behaviour, template structure, `.login-container` class and
`data-testid` hooks; only `login.scss` is restyled with tokens (canvas background, framed panel
with `radius.frame`, logo mark, `canvas.mutedColor` description, language/theme icon buttons).
The hard-coded px radii are removed. It imports `Appearance` from `theme/appearance`.

## 3. Patterns (`app/ui`, domain-neutral)

Superseded: [Patterns](../admin-design-system.md#patterns-srcappui) is authoritative.
Differences from this plan: FilterBuilder (AND conditions, `ListQuery`) replaced FilterBar;
`p-select [multiple]` replaced `p-multiselect`; TablePanel draws its own refresh bar instead of
`p-progressbar`; MenuButton, RowActions and the `ListAction`/`TablePanel.run` model were added;
`listbox` stays registered for the old RelationPicker. The example views hold a `ListQuery` in
signals; `UrlListState`/`ListDefinition` (3.4) exist but no view uses them yet, so the URL
encoding of `ListQuery` per list is an open admin-phase task.

### 3.1 What becomes a component, a CSS pattern or a helper

Components exist only where structure, state or behaviour repeats across screens. Single PrimeNG
controls are used directly (no wrappers): `p-tag` (statuses), `p-selectbutton` (segments),
`p-metergroup`, `p-timeline`, `p-tabs`, `p-autocomplete`, `p-multiselect`, `p-datepicker`,
`p-inputnumber`, `p-toggleswitch`, `p-avatar`, `p-skeleton`.

| Pattern                                                                                                          | Kind           | Used by (screens)                                                                                                                           | Why not something smaller/larger                                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `PageHeader`                                                                                                     | Component      | All 11 pages (Overview, Alerts, Trips, Vehicles, Vehicle detail, Drivers, Scorecard, Maintenance, Devices, Groups, disabled/unknown states) | Owns the single h1, focus target, eyebrow/count/description/actions layout (16 copies today)   |
| `KpiStrip` + `KpiTile`                                                                                           | Components     | Overview, Vehicles, Maintenance, Scorecard, Trip drawer                                                                                     | Divider grid, per-tile loading/error, formatted value + coverage + delta + explanation popover |
| `FilterBar`                                                                                                      | Component      | Alerts, Trips, Vehicles, Drivers, Maintenance, Devices, vehicle tabs                                                                        | Search input, controls slot, chips, clear, mobile disclosure                                   |
| `TablePanel`                                                                                                     | Component      | Every list (7) plus vehicle tabs (3), Overview attention/recent trips, Groups                                                               | Heading/count, the six list states, refresh bar, notice, bulk bar, paginator footer            |
| `RouteDrawer`                                                                                                    | Component      | 12 drawers (vehicle, odometer, device, driver, group, service new/edit, complete, alert, trip)                                              | p-drawer + route close + dirty confirm + unload guard + focus return + states + sticky footer  |
| `FormField`                                                                                                      | Component      | Every drawer field (~70)                                                                                                                    | Label/hint/error/counter wiring with ids and `aria-describedby` (6 variants today)             |
| `EmptyState`                                                                                                     | Component      | TablePanel, cards, drawers, detail pages, FleetWorkspace gates                                                                              | Icon + title + description + actions with the right live role                                  |
| `ColumnSeries`                                                                                                   | Component      | Overview daily distance (14 d); Trips page distance per day (7/30 d)                                                                        | CSS/SVG bars with accessible table                                                             |
| `StackedBars`                                                                                                    | Component      | Trip drawer maneuvers, scorecard maneuvers, Overview groups breakdown                                                                       | Horizontal stacked rows with legend and accessible table                                       |
| `Sparkline`                                                                                                      | Component      | Vehicle detail (speed, fuel, external voltage)                                                                                              | SVG polyline with gaps and an accessible summary                                               |
| Facts (`.app-facts`)                                                                                             | CSS pattern    | Drawers, detail, scorecard                                                                                                                  | A `<dl>` grid has no behaviour                                                                 |
| Form sections (`.app-form-section`, `.app-form-grid`)                                                            | CSS pattern    | Every editor drawer                                                                                                                         | Headings + responsive 1/2-column grid                                                          |
| Cards (`.app-card`, `.app-card-grid`)                                                                            | CSS pattern    | Overview, vehicle detail, scorecard                                                                                                         | Panel surface + grid areas                                                                     |
| Dot, numbers, mono, two-line cells, meter (`.app-dot`, `.app-num`, `.app-mono`, `.app-cell-stack`, `.app-meter`) | CSS patterns   | All tables                                                                                                                                  | Pure presentation                                                                              |
| Timeline event (`.app-timeline-event`)                                                                           | CSS pattern    | Alert and trip timelines, service history                                                                                                   | Content template for `p-timeline`                                                              |
| StatusTag                                                                                                        | **Not built**  |                                                                                                                                             | It would wrap `p-tag`; tones are central tokens + `toneSeverity()`                             |
| `UrlListState` + `list-state`                                                                                    | Helpers        | 7 lists + 3 tabs                                                                                                                            | URL ↔ typed state codec, debounce, normalisation; replaces two near-duplicate query files      |
| `tableView()`                                                                                                    | Helper         | Every TablePanel host                                                                                                                       | One rule for loading/empty/no-results/error/retained rows                                      |
| `runSequential()`                                                                                                | Helper         | Bulk delete (vehicles, devices, drivers), deactivate, acknowledge/resolve                                                                   | Sequential writes with progress, partial failures, stop on retirement                          |
| `fieldErrors()`, `errorCode()`, validators                                                                       | Helpers        | Every drawer                                                                                                                                | One reading of GraphQL `extensions`                                                            |
| `RemoteOptions`                                                                                                  | Helper         | Vehicle, driver and group pickers (drawers and filters)                                                                                     | Debounced, retired remote search + hydration for `p-autocomplete`                              |
| `confirmAction()` (through `TablePanel.run`), `confirmDiscard()`                                                 | Helpers        | Lists and RouteDrawer                                                                                                                       | One confirmation configuration (4 identical copies today)                                      |
| Format pipes and functions                                                                                       | Helpers        | Everywhere                                                                                                                                  | One null/zero rule, Sofia time zone, BG/EN locales                                             |
| `UI_LANGUAGE`, `WALL_CLOCK`, `below()`                                                                           | Tokens/helpers | DS components, Storybook                                                                                                                    | Inject language and time without inputs; deterministic stories                                 |

### 3.2 Folder layout

```text
app/ui/
  page-header/page-header.ts|html|scss|spec.ts
  kpi/kpi-strip.ts, kpi-tile.ts (+ html/scss/spec)
  filter-bar/filter-bar.ts|html|scss|spec.ts
  table-panel/table-panel.ts|html|scss|spec.ts, table-view.ts (+ spec)
  drawer/route-drawer.ts|html|scss|spec.ts, drawer-host.ts, leave-drawer.guard.ts, drawer-route.ts (+ spec)
  form-field/form-field.ts|html|scss|spec.ts
  empty-state/empty-state.ts|html|scss
  charts/column-series.ts, stacked-bars.ts, sparkline.ts (+ specs)
  list/list-state.ts, url-list-state.ts, sequential.ts (+ specs)
  forms/field-errors.ts, validators.ts, focus.ts (+ specs)
  format/format.ts, format.pipes.ts, zoned-time.ts (+ specs)
  remote-options.ts (+ spec), confirm.ts, tones.ts, media.ts (+ spec), clock.ts, ui-language.ts
  i18n/bg.json, en.json, messages.ts (+ messages.spec.ts)
  *.stories.ts beside each component (Design System/*)
```

### 3.3 Component contracts

All components are standalone, `ChangeDetectionStrategy.OnPush`, signal inputs/outputs, selector
prefix `holita-`, BG/EN texts from `uiMessages[inject(UI_LANGUAGE)()]`.

**PageHeader** (`holita-page-header`)

| Member                                                       | Contract                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `eyebrow?: string`                                           | Small uppercase label above the title (e.g. "Автопарк" or "Т-04 · Влекач · Международни")     |
| `title: string` (required)                                   | `<h1 id="page-title" tabindex="-1">`                                                          |
| `count?: number \| null`                                     | Meta badge after the title (list total), formatted with grouping                              |
| `description?: string`                                       | One line, muted, truncated with `title` attribute                                             |
| `backLink?: readonly string[] \| null`, `backLabel?: string` | Small "← Превозни средства" link above the eyebrow (detail pages), preserves no query         |
| Slots `[headerMeta]`, `[headerActions]`                      | Tags/data-clock chip after the title; small icon/text buttons right-aligned (wrap below `md`) |
| `focusTitle()`                                               | Focuses the h1                                                                                |

**KpiStrip** (`holita-kpi-strip`) and **KpiTile** (`holita-kpi-tile`)

| Member                                                                                                            | Contract                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Strip `label: string` (required)                                                                                  | `role="group"` + `aria-label`                                                                                             |
| Strip `loading`, `error: string \| null`, output `retry`                                                          | Whole-strip skeleton; error replaces tiles with an inline message + Retry, keeping last values when the host passes them  |
| Tile `label` (required), `value: string \| null`, `unit?`                                                         | Value pre-formatted by the host; `null` renders "—" (never 0)                                                             |
| Tile `secondary?: string`, `footnote?: string`                                                                    | E.g. "в сервиз: 4"; coverage "38 от 42 с устройство"                                                                      |
| Tile `delta?: { text: string; trend: 'up' \| 'down' \| 'flat'; sentiment: 'good' \| 'bad' \| 'neutral' } \| null` | Arrow + text; tone from sentiment                                                                                         |
| Tile `tone?: StatusTone \| null`                                                                                  | 3 px marker on the inline start                                                                                           |
| Tile `explanation?: string`                                                                                       | Info icon button opening a `p-popover` with the formula and window (keyboard and touch accessible)                        |
| Tile `link?: readonly string[] \| null`, `queryParams?`                                                           | Whole tile becomes a link (e.g. applies a list filter)                                                                    |
| Tile `loading`                                                                                                    | Per-tile skeleton                                                                                                         |
| Layout                                                                                                            | One panel; tiles in `repeat(auto-fit, minmax(kpi.minWidth, 1fr))` separated by 1 px inline dividers; 2 columns below `md` |

**FilterBar** (`holita-filter-bar`)

| Member                                                            | Contract                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `searchLabel: string` (required), `search: string`                | `p-iconfield` + `pInputText type="search"`, visible label hidden visually, `maxlength="200"`              |
| `searchError?: string \| null`                                    | Inline error below the field (e.g. more than five words)                                                  |
| `chips: readonly { key: string; label: string }[]`, `activeCount` | Applied-filter chips (removable) and the count on the mobile "Филтри (n)" toggle                          |
| Outputs `searchChange(string)`, `removeChip(key)`, `clearAll()`   | Raw values; debounce lives in `UrlListState`                                                              |
| Slots `[filterSegments]`, `[filterControls]`, `[filterActions]`   | Segments (first row, left), controls (wrap), trailing actions (e.g. "Reset sort")                         |
| Mobile (< `sm`)                                                   | Search stays visible; segments scroll horizontally; controls collapse behind the toggle (`aria-expanded`) |

**TablePanel** (`holita-table-panel`)

```ts
export type TableView =
  | { readonly kind: 'loading' } // first load, no rows: skeleton rows
  | { readonly kind: 'rows' } // rows present (maybe refreshing)
  | { readonly kind: 'empty' } // no records and no search/filters
  | { readonly kind: 'no-results' } // search or filters active and zero rows
  | { readonly kind: 'error' } // first load failed: error state + Retry
  | { readonly kind: 'rows-error' }; // refresh failed: inline error + Retry above retained rows
export function tableView(input: {
  loading: boolean;
  error: unknown;
  rows: number | null;
  filtered: boolean;
}): TableView;
```

| Member                                                                                                                  | Contract                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading: string` (required), `headingLevel: 2 \| 3 = 2`, `total: number \| null`                                       | Panel header with count badge                                                                                                                                                                                                   |
| `view: TableView` (required), `errorText: string`, `busy: boolean`                                                      | `busy` with rows shows a 2 px indeterminate `p-progressbar` at the top and `aria-busy="true"`                                                                                                                                   |
| `emptyTitle`, `emptyDescription`, slot `[emptyActions]`                                                                 | Text and CTAs for `empty`; `no-results` uses the catalog text + "Изчисти филтрите" (`clearFilters` output)                                                                                                                      |
| `notice: { severity: 'success' \| 'warn' \| 'error'; text: string } \| null`, output `dismissNotice`                    | Closable `p-message` strip under the header with `role="status"` (saved, deleted N, partial failures)                                                                                                                           |
| `actions`, `selection` (`ListRecord[]`), `selectionProgress`, outputs `action`, `clearSelection`; `run()`               | Floating bulk bar (`position: sticky; bottom: gutter`, `shadow.floating`) with "N избрани", actions, clear; `role="region"` labelled                                                                                            |
| `page: { page: number; pageSize: number; total: number } \| null`, `pageSizes = [10, 20, 50, 100]`, output `pageChange` | `p-paginator` footer bound to the standard list contract (1-based page), page report "1–20 от 45", `[locale]`                                                                                                                   |
| Slots `[panelActions]` (header right), default (the `p-table`), `[panelFooter]` (left of paginator, e.g. Σ distance)    |                                                                                                                                                                                                                                 |
| Skeleton                                                                                                                | `skeletonRows` (default `min(pageSize, 8)`) bars at `row.height`                                                                                                                                                                |
| Table conventions (host template)                                                                                       | `p-table` with `[lazy]`, `dataKey="id"`, `[rowTrackBy]`, `[scrollable]` horizontal scroll inside the panel, first column sticky, no `emptymessage` template (TablePanel renders states), `.app-col-secondary` hidden below `md` |

**RouteDrawer** (`holita-route-drawer`)

| Member                                                                                               | Contract                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` (required), `subtitle?`, slot `[drawerMeta]`                                                 | Header h2 (`aria-labelledby`), tags beside it                                                                                                                                                                                                                                                                               |
| `size: 'md' \| 'lg' = 'md'`                                                                          | `drawer.width.md/lg`; full width below `md`                                                                                                                                                                                                                                                                                 |
| `state: 'loading' \| 'ready' \| 'not-found' \| 'invalid-id' \| 'error'`, `errorText`, output `retry` | Skeleton fields / content / EmptyState (`not-found`, `invalid-id` role alert) / error with Retry                                                                                                                                                                                                                            |
| `saving: boolean`                                                                                    | `aria-busy`, footer buttons disabled by the host                                                                                                                                                                                                                                                                            |
| `dirty: boolean`                                                                                     | Enables the unload guard (`beforeunload`) and the discard confirmation                                                                                                                                                                                                                                                      |
| `closeLink: readonly unknown[] = ['..']`                                                             | Close button, Escape and backdrop call `close()`: navigate to `closeLink` relative to the drawer route with `queryParamsHandling: 'preserve'` and `preserveFragment`                                                                                                                                                        |
| Slots: default (body, usually a `<form>`), `[drawerFooter]`                                          | Body scrolls; footer is sticky with `.app-drawer-actions` (primary action last on the right; stacked full-width below `sm`)                                                                                                                                                                                                 |
| `confirmLeave(dirty: boolean): boolean \| Promise<boolean>`                                          | Used by the host's `canLeave()`; opens the discard `p-confirmdialog` (own `ConfirmationService`, default focus "Продължи редакцията") and dedupes concurrent requests                                                                                                                                                       |
| Focus                                                                                                | Captures `document.activeElement` on creation; PrimeNG focus trap; on destroy restores focus to the captured element when it is still connected, else to `#page-title`                                                                                                                                                      |
| Visibility                                                                                           | `p-drawer` `position="right"`, `modal`, `blockScroll`, `appendTo="body"`, `[visible]="true"`; Escape, backdrop and the close icon are routed to `close()` (PrimeNG's own dismissal disabled or its `visibleChange(false)` immediately reverted, whichever shows no flicker), so a canceled navigation keeps the drawer open |

`drawer/leave-drawer.guard.ts`:

```ts
export interface LeavableDrawer {
  canLeave(): boolean | Promise<boolean>;
}
/** Drawer routes can be active without a mounted component (signed out, Fleet disabled,
 * unknown Branch, Branch discovery hiding the outlet); only a mounted drawer can block. */
export const leaveDrawer: CanDeactivateFn<LeavableDrawer | null> = (component) =>
  component?.canLeave() ?? true;
```

It is used on every drawer route (the same null handling as today's `leaveFleet`).
`drawer/drawer-host.ts`:

```ts
export interface DrawerSaved {
  readonly message: string;
  readonly recordId: string | null;
}
export interface DrawerHost {
  saved(event: DrawerSaved): void;
}
/** Reads ROUTER_OUTLET_DATA with a runtime check; returns a no-op host when absent (isolated stories). */
export function injectDrawerHost(): DrawerHost;
```

Hosts render `<router-outlet [routerOutletData]="drawerHost" />`. A drawer calls
`host.saved({ message, recordId })` only while it is not destroyed, then navigates to its close link.
The host refetches through its own client (if still current) and shows `message` as the
TablePanel notice.

**FormField** (`holita-form-field`): inputs `label` (required), `controlId` (required), `hint?`,
`error?` (string; rendered as `p-message severity="error" variant="simple" size="small"` in
`#<controlId>-error`), `required = false` (visual marker + "(задължително)" for screen readers),
`counter?: { length: number; max: number } | null` (code points, "1 234 / 2 000", warns past 90 %).
The projected control sets `[attr.aria-describedby]="'<id>-hint <id>-error'"`,
`[attr.aria-invalid]` and `[invalid]`. Layout: stacked label/control/hint/error; full width in
`.app-form-grid` columns; `.app-form-grid--wide` spans both columns.

**EmptyState** (`holita-empty-state`): input `kind` is one of `empty`, `no-results`, `error`,
`not-found`, `disabled`, `no-telemetry`, `done` (icon + tone); `title` (required), `description?`,
`compact = false`; slot `[emptyActions]`. `error` and `not-found` render `role="alert"` (the
"Branch not found" smoke keeps `getByRole('alert')`), others `role="status"`.

**ColumnSeries** (`holita-column-series`): inputs `label` (required, accessible name), `points:
readonly { key: string; label: string; value: number | null; valueText: string }[]`,
`highlightLast = true`; CSS grid of bars scaled to the maximum, zero shown as a hairline, null as an
empty slot; a visually hidden `<table>` repeats the data.

**StackedBars** (`holita-stacked-bars`): inputs `label`, `rows: readonly { key: string; label:
string; total: number; totalText: string; segments: readonly { key: string; value: number; tone:
StatusTone | CategorySlot | 'muted' }[] }[]`, `legend: readonly { key: string; label: string; tone }[]`,
optional shared `max`; visually hidden table.

**Sparkline** (`holita-sparkline`): inputs `label`, `points: readonly { at: number; value: number |
null }[]`, `from`, `to` (ms), `unit`, `valueText(last)`, optional `min`, `max` (fuel uses 0–100); SVG
`viewBox` 0 0 240 48, 1.5 px `primary.color` stroke, gaps for nulls, `role="img"` + `aria-label`
("Скорост, последни 48 ч: 0–96 км/ч, последно 72 км/ч").

### 3.4 List helpers

`list/list-state.ts` (pure, fully unit-tested):

```ts
export type SortDirection = 'ASC' | 'DESC';
export interface ListState<F, S extends string> {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly sort: { readonly field: S; readonly direction: SortDirection };
  readonly filter: F;
}
export interface FilterCodec<T> {
  read(values: readonly string[]): T | undefined;
  write(value: T | undefined): string | null;
  same(a: T | undefined, b: T | undefined): boolean;
}
export interface SortDefault<S extends string> {
  readonly field: S;
  readonly direction: SortDirection;
}
export interface ListDefinition<F, S extends string> {
  readonly pageSizes: readonly number[]; // [10, 20, 50, 100]
  readonly defaultPageSize: number; // 20
  readonly sorts: readonly { readonly param: string; readonly field: S }[];
  readonly defaultSort: SortDefault<S>;
  /** Optional per-view defaults: when URL param `param` has one of the listed values, that entry
   * replaces `defaultSort` (Maintenance: `{ param: 'view', sorts: { completed: COMPLETED_ON DESC } }`). */
  readonly viewDefaultSorts?: {
    readonly param: string;
    readonly sorts: Readonly<Record<string, SortDefault<S>>>;
  };
  readonly filters: { readonly [K in keyof F]-?: FilterCodec<F[K]> };
  /** Optional pure cross-field rule applied after decoding and before writing; a changed result
   * rewrites the URL with replaceUrl (Vehicles: groupIds wins over hasGroup=false, 5.4). */
  readonly normalizeFilter?: (filter: F) => F;
}
export const codecs: {
  enumList<T extends string>(values: readonly T[]): FilterCodec<readonly T[]>;
  idList(max: number): FilterCodec<readonly string[]>;
  boolean(): FilterCodec<boolean>;
  dateOnly(): FilterCodec<string>;
  choice<T extends string>(values: readonly T[], fallback: T): FilterCodec<T>;
  /** Integer in [min, max]; anything else is dropped (e.g. documentsExpireWithinDays 0–365). */
  integer(min: number, max: number): FilterCodec<number>;
  /** Finite decimal in [min, max] rounded to `step` (e.g. drivingScoreBelow 0–100, step 1). */
  number(min: number, max: number, step: number): FilterCodec<number>;
};
export function readListState<F, S extends string>(
  params: ParamMap,
  definition: ListDefinition<F, S>,
): ListState<F, S>;
export function listStateParams<F, S extends string>(
  state: ListState<F, S>,
  definition: ListDefinition<F, S>,
): Params; // defaults → null
export function sameListState<F, S extends string>(
  a: ListState<F, S>,
  b: ListState<F, S>,
  definition: ListDefinition<F, S>,
): boolean;
export function activeFilterCount<F, S extends string>(
  state: ListState<F, S>,
  definition: ListDefinition<F, S>,
): number;
export function searchTokens(search: string): readonly string[]; // trim, split on Unicode whitespace
```

**URL state standard** (every list and tab):

| Param           | Meaning                                                                                            | Rules                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`        | Search text                                                                                        | Trimmed, NUL removed, ≤ 200 code points; > 5 words is not applied (FilterBar error)                                                                                                       |
| `sort`          | Sort param from the list's `sorts` (camelCase field name)                                          | Absent = the effective default field (`viewDefaultSorts` entry for the current view, else `defaultSort`); unknown values normalise to it                                                  |
| `order`         | `asc` \| `desc`                                                                                    | Absent = the effective default direction for the effective default field, `asc` for other fields; written only when different                                                             |
| `page`          | 1-based page                                                                                       | Absent = 1; clamped to `floor(2147483647 / pageSize) + 1`; corrected to the last page after totals arrive                                                                                 |
| `pageSize`      | 10, 20, 50, 100                                                                                    | Absent = 20                                                                                                                                                                               |
| `<filterField>` | GraphQL filter field name (`statuses`, `vehicleTypes`, `groupIds`, `hasDevice`, …)                 | Comma-separated values; enum/UUID validated, unknown values dropped; lists ≤ 100 values; booleans `true`/`false`; numbers as plain decimals within the codec range (out of range dropped) |
| UI params       | `status` (Alerts segment), `view` (Maintenance segment), `period`, `from`, `to` (date-only, Sofia) | Documented per screen; mapped to filter fields by the page                                                                                                                                |

Any change except `page`/`pageSize` resets to page 1. Invalid or non-normalised URLs are rewritten
with `replaceUrl`. Selection is retained only across same-state refreshes.

`list/url-list-state.ts`: `class UrlListState<F, S extends string>` constructed in a field
initializer (`new UrlListState(definition)`; injects `ActivatedRoute`, `Router`, `DestroyRef`).
Members: `state: Signal<ListState<F, S>>`, `changes: Observable<ListState<F, S>>` (normalised,
distinct by `sameListState`), `searchDraft: WritableSignal<string>`, `searchError: Signal<string |
null>` (catalog key), `editSearch(value)` (300 ms debounce), `patchFilter(changes)`,
`setSort(field, direction)`, `sortFromTable(event: unknown)` (maps a `p-table` sort event via
`definition.sorts`, coalesced with `timer(0)`), `resetSort()`, `setPage({ page, pageSize })`,
`clearFilters()` (search and filters), `correctPage(lastPage)` (`replaceUrl`), `cancelPending()`.
It never fetches data: each page maps state to its own typed variables
(`vehicleListVariables(state): AdminFleetVehiclesQueryVariables`).

`list/sequential.ts`:

```ts
export async function runSequential<T>(
  items: readonly T[],
  action: (item: T) => Promise<unknown>,
  options: {
    isCurrent(): boolean;
    progress(done: number, total: number): void;
    errorText(error: unknown, item: T): string;
  },
): Promise<{
  readonly succeeded: readonly T[];
  readonly failures: readonly { item: T; message: string }[];
  readonly stopped: boolean;
}>;
```

Stops sending further items once `isCurrent()` is false (submitted writes still settle); hosts keep
failed rows selected and refetch once.

### 3.5 Forms and errors

- `forms/field-errors.ts`: `errorCode(error)` returns the `extensions.code` of a
  `CombinedGraphQLErrors` (`BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE`,
  `UNAUTHENTICATED`) or `null`, and
  `fieldErrors<F extends string>(error, fields: readonly F[]): Partial<Record<F, string>>`
  (generalises `vehicleFieldErrors`: first message per known path, ≤ 30 entries, ≤ 300 chars).
- Displayed text: the drawer shows its catalog text `serverFieldErrors[path]` for the language
  (e.g. `vin`: "Този VIN вече се използва в клона."), because client validation already covers
  formats and ranges; it falls back to the server message only for paths without a catalog text.
  After a failed save the first invalid field receives focus; the draft is retained.
- `forms/validators.ts`: `textValidator(max, { required })` (code points, NUL, trim — replaces
  `vehicleText`), `patternValidator(regex, { transform: 'upper' | 'none' })`,
  `integerValidator(min, max)`, `decimalValidator(min, max, step)`, `dateOnlyValidator(min, max)`,
  `requireOneOf(a, b)` (group-level, error on the first control). Error keys are fixed strings the
  catalogs translate.
- `forms/focus.ts`: `focusFirstInvalid(form: HTMLElement, order: readonly string[], prefix)`.
- Drawer error mapping: `BAD_USER_INPUT` with `fieldErrors` → fields; without → drawer-level
  `p-message`; `CONFLICT` → drawer-level message from the catalog with a "Презареди" action that
  refetches the record and keeps the draft; `NOT_FOUND` → `state = 'not-found'`;
  `SERVICE_UNAVAILABLE` and network → drawer-level message from `requestError()` with the request ID.

### 3.6 Remote options

`remote-options.ts`: `class RemoteOptions<T extends { id: string }>` with constructor
`(load: (search: string, ids: readonly string[] | null) => Observable<readonly T[]>)`; members
`options: Signal<readonly T[]>`, `loading`, `error`, `search(text)` (250 ms debounce, latest wins,
obsolete results ignored), `hydrate(ids)` (loads selected records by `ids`), `dispose()` via
`DestroyRef`. Feature drawers/filters pass a loader that calls their own feature API (their own
captured client) with the shared option operations (5.0). Templates use
`p-autocomplete [suggestions]="picker.options()" (completeMethod)="picker.search($event.query)"
optionLabel="label" [forceSelection]="true" [dropdown]="true"` with a typed option model
`{ id, label, detail }`.

### 3.7 Formatting (`app/ui/format`)

Pure functions (and thin pipes with `inject(UI_LANGUAGE)`): locale `bg-BG` / `en-GB`.

| Function                                                                                               | Rule                                                                                         |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `formatNumber(value, language, { fraction })`                                                          | `null`/`undefined` → "—"; `0` → "0"; grouping per locale                                     |
| `formatDistanceKm`, `formatSpeed`, `formatLitres`, `formatVolts`, `formatPercent`, `formatTemperature` | Units from the catalog (`км`, `км/ч`, `л`, `V`, `%`, `°C`); one decimal where meaningful     |
| `formatMoneyCents(cents, language)`                                                                    | EUR currency format from integer cents; `null` → "—"; `0` → "0,00 €"                         |
| `formatDateTime(iso, language, timeZone)`                                                              | `dd.MM.yyyy HH:mm` (bg) / `dd MMM yyyy, HH:mm` (en) in the given zone                        |
| `formatDateOnly('YYYY-MM-DD', language)`                                                               | Formats calendar dates without zone conversion (UTC parts)                                   |
| `formatRelative(iso, reference, language)`                                                             | "преди 12 мин" / "12 min ago", relative to an explicit reference instant (telemetry: `asOf`) |
| `formatDuration(seconds, language)`                                                                    | "1 ч 07 мин" / "1 h 07 min"                                                                  |
| `zonedWallTimeToIso(parts, timeZone)` / `isoToZonedParts(iso, timeZone)`                               | DateTime inputs edit Sofia wall time; DST-aware via `Intl.DateTimeFormat` offset lookup      |
| `toDateOnly(date)` / `fromDateOnly(text)`                                                              | DatePicker `Date` (local calendar day) ↔ `YYYY-MM-DD`                                        |

`WALL_CLOCK` (`app/ui/clock.ts`): `InjectionToken<() => number>` (root default `Date.now`); used
for stale banners, "≤ now" validation and default form times. `UI_LANGUAGE`
(`app/ui/ui-language.ts`): `InjectionToken<Signal<Language>>`, root default `signal('bg')`,
provided by `AdminWorkspace` as its `language` signal.

## 4. Routing and lifecycle

### 4.1 Route tree

`fleet.routes.ts` (F2) replaces the six flat routes. All drawer routes carry
`canDeactivate: [leaveDrawer]` and the drawer data of 4.1.1; the four vehicle detail tabs carry
`data: { tab: true }` (focus stays on the tab); routes with a `:recordId`,
`:vehicleId` or `:driverId` of their own carry `data: { recreateOnParamsChange: true }`.

```text
:language                                  AdminWorkspace (unchanged route)
├─ karma-client/…                          unchanged
├─ :branchId/reference                     → redirect :branchId/fleet (kept)
└─ :branchId/fleet                         FleetWorkspace   data { recreateOnParamsChange }
   ├─ ''                                   → redirect overview
   ├─ overview                             OverviewPage
   ├─ alerts                               AlertsPage
   │  └─ :recordId                         AlertDrawer
   ├─ trips                                TripsPage
   │  └─ :recordId                         TripDrawer
   ├─ vehicles                             VehiclesPage
   │  ├─ new                               VehicleEditorDrawer
   │  └─ :recordId/edit                    VehicleEditorDrawer
   ├─ vehicles/:vehicleId                  VehicleDetailPage
   │  ├─ ''                                → redirect overview
   │  ├─ overview                          VehicleOverviewTab
   │  │  ├─ edit                           VehicleEditorDrawer
   │  │  └─ odometer                       OdometerDrawer
   │  ├─ trips                             VehicleTripsTab        (trips folder)
   │  │  └─ :recordId                      TripDrawer
   │  ├─ alerts                            VehicleAlertsTab       (alerts folder)
   │  │  └─ :recordId                      AlertDrawer
   │  └─ service                           VehicleServiceTab      (maintenance folder)
   │     ├─ new                            ServiceTaskEditorDrawer (vehicle fixed)
   │     ├─ :recordId/edit                 ServiceTaskEditorDrawer
   │     └─ :recordId/complete             ServiceCompleteDrawer
   ├─ drivers                              DriversPage
   │  ├─ new                               DriverEditorDrawer
   │  └─ :recordId/edit                    DriverEditorDrawer
   ├─ drivers/:driverId                    DriverScorecardPage
   │  ├─ profile/edit                      DriverEditorDrawer
   │  └─ trips/:recordId                   TripDrawer
   ├─ maintenance                          MaintenancePage
   │  ├─ new                               ServiceTaskEditorDrawer
   │  ├─ :recordId/edit                    ServiceTaskEditorDrawer
   │  └─ :recordId/complete                ServiceCompleteDrawer
   ├─ devices                              DevicesPage
   │  ├─ new                               DeviceEditorDrawer (optional ?vehicleId= preselects)
   │  └─ :recordId/edit                    DeviceEditorDrawer
   ├─ settings                             → redirect settings/groups
   ├─ settings/groups                      VehicleGroupsPage
   │  ├─ new                               VehicleGroupEditorDrawer
   │  └─ :recordId/edit                    VehicleGroupEditorDrawer
   └─ **                                   → redirect overview
```

Matching notes (asserted by `fleet.routes.spec.ts`; Angular takes the first matching route and
backtracks only when the children cannot consume the remaining segments):

- `vehicles/<id>/edit` matches the list's child (list + drawer); `vehicles/<id>/overview` and
  `vehicles/<id>/overview/edit` backtrack to the detail route; `vehicles/new` never reaches
  `vehicles/:vehicleId`.
- `drivers/<id>/edit` matches the Drivers list's child `:recordId/edit` (list + drawer), exactly
  like vehicles. The scorecard's editor is therefore `drivers/<id>/profile/edit`: the list's
  `:recordId/edit` cannot consume `<id>/profile/edit` ("profile" ≠ "edit"), so it backtracks to
  `drivers/:driverId` → `profile/edit`. `drivers/<id>` and `drivers/<id>/trips/<tripId>` also
  backtrack to the scorecard; `drivers/new` stays on the list.
- `vehicles/<id>/service/new` resolves to VehicleDetailPage → VehicleServiceTab →
  ServiceTaskEditorDrawer in create mode with the vehicle fixed (4.1.1).

Every component is `loadComponent` (lazy), from the files listed in 4.1.2.

#### 4.1.1 Drawer route data

Each drawer route declares its mode and the one route parameter that holds its own record, so no
drawer guesses from a shared fallback list:

```ts
export interface DrawerRouteData {
  readonly drawer: true;
  readonly mode: 'create' | 'edit' | 'view';
  /** Parameter holding this drawer's own record ID (edit and view modes). */
  readonly recordParam?: 'recordId' | 'vehicleId' | 'driverId';
  /** Parameter that fixes the vehicle of a record created here. */
  readonly fixedVehicleParam?: 'vehicleId';
}
```

`app/ui/drawer/drawer-route.ts` exports `drawerRouteData(route: ActivatedRoute): DrawerRouteData`
(runtime-checked, throws on a misconfigured route) and `drawerParam(route, name)`, which reads that
single named parameter from the drawer's own snapshot or its ancestors (`pathFromRoot`, nearest
first). `recordId` is never read for a drawer whose `recordParam` is another name, and a create
drawer never reads a record ID.

| URL (under `:branchId/fleet/`)                   | Component                | `mode`   | `recordParam` | `fixedVehicleParam` |
| ------------------------------------------------ | ------------------------ | -------- | ------------- | ------------------- |
| `alerts/:recordId`                               | AlertDrawer              | `view`   | `recordId`    | —                   |
| `trips/:recordId`                                | TripDrawer               | `view`   | `recordId`    | —                   |
| `vehicles/new`                                   | VehicleEditorDrawer      | `create` | —             | —                   |
| `vehicles/:recordId/edit`                        | VehicleEditorDrawer      | `edit`   | `recordId`    | —                   |
| `vehicles/:vehicleId/overview/edit`              | VehicleEditorDrawer      | `edit`   | `vehicleId`   | —                   |
| `vehicles/:vehicleId/overview/odometer`          | OdometerDrawer           | `create` | —             | `vehicleId`         |
| `vehicles/:vehicleId/trips/:recordId`            | TripDrawer               | `view`   | `recordId`    | —                   |
| `vehicles/:vehicleId/alerts/:recordId`           | AlertDrawer              | `view`   | `recordId`    | —                   |
| `vehicles/:vehicleId/service/new`                | ServiceTaskEditorDrawer  | `create` | —             | `vehicleId`         |
| `vehicles/:vehicleId/service/:recordId/edit`     | ServiceTaskEditorDrawer  | `edit`   | `recordId`    | —                   |
| `vehicles/:vehicleId/service/:recordId/complete` | ServiceCompleteDrawer    | `edit`   | `recordId`    | —                   |
| `drivers/new`                                    | DriverEditorDrawer       | `create` | —             | —                   |
| `drivers/:recordId/edit`                         | DriverEditorDrawer       | `edit`   | `recordId`    | —                   |
| `drivers/:driverId/profile/edit`                 | DriverEditorDrawer       | `edit`   | `driverId`    | —                   |
| `drivers/:driverId/trips/:recordId`              | TripDrawer               | `view`   | `recordId`    | —                   |
| `maintenance/new`                                | ServiceTaskEditorDrawer  | `create` | —             | —                   |
| `maintenance/:recordId/edit`                     | ServiceTaskEditorDrawer  | `edit`   | `recordId`    | —                   |
| `maintenance/:recordId/complete`                 | ServiceCompleteDrawer    | `edit`   | `recordId`    | —                   |
| `devices/new` (optional `?vehicleId=`)           | DeviceEditorDrawer       | `create` | —             | —                   |
| `devices/:recordId/edit`                         | DeviceEditorDrawer       | `edit`   | `recordId`    | —                   |
| `settings/groups/new`                            | VehicleGroupEditorDrawer | `create` | —             | —                   |
| `settings/groups/:recordId/edit`                 | VehicleGroupEditorDrawer | `edit`   | `recordId`    | —                   |

`fleet.routes.spec.ts` asserts this table for every row, including all three
ServiceTaskEditorDrawer URLs (`vehicles/<id>/service/new` is create mode with the fixed vehicle
and never loads `fleetServiceTask(id: <vehicleId>)`).

#### 4.1.2 Routed component files

Every routed component has a fixed file and class name. S creates each file as a minimal stub in
F2 (pages and tabs render `PageHeader` + `EmptyState` "В разработка"/"In progress"; drawers render
`RouteDrawer` in state `ready` with a title and implement `canLeave(): boolean` returning `true`),
so `fleet.routes.ts` and `fleet.routes.spec.ts` resolve every chain in F2. Ownership of each stub
passes to the screen agent in the last column at F3 start; the class name, file name and selector
never change.

| File (under `apps/admin/src/app/features/fleet/`) | Class                      | Owner from F3 |
| ------------------------------------------------- | -------------------------- | ------------- |
| `fleet-workspace.ts`                              | `FleetWorkspace`           | S             |
| `overview/overview-page.ts`                       | `OverviewPage`             | G5            |
| `alerts/alerts-page.ts`                           | `AlertsPage`               | G3            |
| `alerts/alert-drawer.ts`                          | `AlertDrawer`              | G3            |
| `alerts/vehicle-alerts-tab.ts`                    | `VehicleAlertsTab`         | G3            |
| `trips/trips-page.ts`                             | `TripsPage`                | G3            |
| `trips/trip-drawer.ts`                            | `TripDrawer`               | G3            |
| `trips/vehicle-trips-tab.ts`                      | `VehicleTripsTab`          | G3            |
| `vehicles/vehicles-page.ts`                       | `VehiclesPage`             | G1            |
| `vehicles/vehicle-editor-drawer.ts`               | `VehicleEditorDrawer`      | G1            |
| `vehicles/vehicle-detail-page.ts`                 | `VehicleDetailPage`        | G1            |
| `vehicles/vehicle-overview-tab.ts`                | `VehicleOverviewTab`       | G1            |
| `vehicles/odometer-drawer.ts`                     | `OdometerDrawer`           | G1            |
| `maintenance/maintenance-page.ts`                 | `MaintenancePage`          | G4            |
| `maintenance/service-task-editor-drawer.ts`       | `ServiceTaskEditorDrawer`  | G4            |
| `maintenance/service-complete-drawer.ts`          | `ServiceCompleteDrawer`    | G4            |
| `maintenance/vehicle-service-tab.ts`              | `VehicleServiceTab`        | G4            |
| `drivers/drivers-page.ts`                         | `DriversPage`              | G2            |
| `drivers/driver-editor-drawer.ts`                 | `DriverEditorDrawer`       | G2            |
| `drivers/driver-scorecard-page.ts`                | `DriverScorecardPage`      | G2            |
| `devices/devices-page.ts`                         | `DevicesPage`              | G5            |
| `devices/device-editor-drawer.ts`                 | `DeviceEditorDrawer`       | G5            |
| `vehicle-groups/vehicle-groups-page.ts`           | `VehicleGroupsPage`        | G2            |
| `vehicle-groups/vehicle-group-editor-drawer.ts`   | `VehicleGroupEditorDrawer` | G2            |

Templates and styles live beside each file (`.html`, `.scss`) once the screen agent needs them.

### 4.2 Reuse, keying and Apollo client ownership

- `app/core/routing/param-keyed-reuse-strategy.ts` (F2) declares
  `ParamKeyedReuseStrategy`, a subclass of `BaseRouteReuseStrategy`. Its `shouldReuseRoute`
  returns `false` when `future.data['recreateOnParamsChange'] === true` and the route's own
  `params` differ; otherwise it returns the default. Karma routes do not carry the flag and keep
  their current behaviour.
- `app/core/routing/provide-admin-router.ts` (F2, S) exports `provideAdminRouter()`, returning
  `[provideRouter(routes), { provide: RouteReuseStrategy, useClass: ParamKeyedReuseStrategy }]`.
  `app.config.ts` uses it instead of `provideRouter(routes)`, and every route-level spec that
  exercises Fleet routing (`fleet.routes.spec.ts`, `fleet-workspace.spec.ts`,
  `branch-context.spec.ts`, `admin-workspace.spec.ts`, `param-keyed-reuse-strategy.spec.ts` and the
  F3 page/drawer specs that navigate) uses it too, so the A → B → A and drawer-recreation cases run
  with the production strategy. The Karma specs keep `provideRouter(routes)` unchanged (no Karma
  route carries the flag).
- `FleetWorkspace` (F2) keeps gating (disabled Fleet, unknown Branch, signed-out) and wraps its
  `<router-outlet />` in `@for (scope of activeScope(); track scope.key)`, where the key joins the
  session token, the language and the Branch ID. A Branch change destroys the subtree through the
  reuse strategy before any child sees new route events; a language or session change recreates
  it through the key. `FleetWorkspace.scope()` returns the immutable `FleetScope`
  (`sessionToken`, `branch`, `language`) captured by the current key and throws outside an active
  scope. Pages, tabs and drawers capture it once with `injectFleetScope()` from
  `fleet/shared/fleet-scope.ts`.
- **Client ownership:** every routed page, tab and drawer lists `ScopedGraphqlClient` and its
  feature API in its component `providers`, so each owns one Apollo client and `InMemoryCache`
  bound to its captured session/Branch/language. Cards inside a page share the page's client but
  use separate watch queries. Drawers never share the host's client; after a write they notify the
  host (4.4), which refetches through its own client.
- `app/core/graphql/scoped-graphql-client.ts` (F2) extracts the lifecycle now copied into
  `VehiclesApi` and `DevicesApi`:
  - `initialize(scope)`: once per instance, builds the client with `graphqlOptions(httpLink, url, scope, session.capture())`;
  - `watch(document, variables, options?)` and `query(document, variables)` (network-only, one shot);
  - `mutate(document, variables, { evict })`: counts pending writes and evicts the listed `ROOT_QUERY` fields only in this client;
  - `ngOnDestroy()`: retires reads and stops the client once no write is pending.

  It is typed with `TypedDocumentNode<R, V>` (no `any`). Feature APIs are thin, concrete method
  sets over it (`watchVehicles(variables)`, `deactivate(id)`, …).

- **A → B → A:** returning to A creates new page/drawer instances and new clients; late A results
  never reach B; writes submitted in A settle against A's client and only evict A's cache; their
  callbacks check `DestroyRef.destroyed` before notifying, navigating or touching signals.

### 4.3 AdminWorkspace and BranchContext changes

- `AdminWorkspace` (F1 DS agent: shell swap, `UI_LANGUAGE`, navigation/context/title, PrimeNG
  translations; F2 scaffolding agent: landing): keeps `session`, `branches`, `language()`, `text()`,
  `logout()`, `languageLink()` (Karma depends on `session` and `language()`).
- `BranchContext` (F2): keeps `choose(id, language)` (called by `karma-workspace.spec.ts`). Default
  navigation and `enter()` go to `['/', language, id, 'fleet']` (→ Overview). `choose()` preserves
  the active Fleet section via `fleetSectionPath(router.url)` from `fleet/fleet-navigation.ts`
  (`overview`, `alerts`, `trips`, `vehicles`, `drivers`, `devices`, `maintenance`,
  `settings/groups`; default `overview`) and drops record IDs, tabs, drawers and query parameters.
  Karma routes (`requiresBranch: false`) keep remembering the Branch without navigation.

### 4.4 Drawer lifecycle

1. Opening: a row link/button navigates to the child route; the host stays mounted with its rows,
   selection, scroll and client.
2. The drawer creates its own client, loads the record with a network-only read (or starts
   empty), hydrates the typed form once, focuses its first field (create) or title (edit/read-only).
3. Saving: form disabled, `saving` true; on success `host.saved({ message, recordId })` then
   `close()`; on failure 3.5 mapping, draft retained, form re-enabled, focus first invalid field.
4. Closing (button, Escape, backdrop, browser back, Branch switch, language switch, logout, any
   navigation): `leaveDrawer` → `canLeave()` → `confirmLeave(form.dirty && !saving)`; "keep editing"
   cancels the navigation (the Branch menu keeps showing the active Branch, since its label
   follows `branchId`).
5. Destroyed: reads retired, pending writes settle silently, focus returns to the trigger.
6. Record change while open (link to another record): the reuse strategy recreates the drawer.

### 4.5 Focus restoration summary

| Event                                  | Focus target                                            |
| -------------------------------------- | ------------------------------------------------------- |
| Page navigation (sidebar, links, tabs) | `#page-title` (tabs: the active tab)                    |
| Drawer opened                          | First field (create) or drawer title                    |
| Drawer closed                          | Trigger element, else `#page-title`                     |
| Bulk action finished                   | TablePanel heading (notice announced via `role=status`) |
| Confirm dialog closed                  | Its trigger (PrimeNG default)                           |
| Mobile navigation closed               | Menu button                                             |

## 5. Screens

The presentational views and drawers already exist (`features/fleet/<feature>/*-view.ts`,
`*-drawer.ts`; groups and General settings under `settings/`). Per screen, the remaining work is
the container that replaces the story host, the API, operations, routes, the Bulgarian catalog,
unit specs and the smoke. Where the example views offer filters, sorts or enum values the backend
contract cannot express, see the
[admin-phase notes](admin-design-system.md#admin-phase-per-screen-f3).
Not designed yet: the driver scorecard (5.7), the odometer drawer (5.4, 5.5) and the completion
form of 5.8.

### 5.0 Shared Fleet foundation (`features/fleet/shared/`, F2)

**Operation rules.** Every operation file is self-contained: `tools/graphql/contracts.mts`
validates each file separately, so a fragment is defined in the file that uses it, and fragment and
operation names are unique across the admin (prefix `AdminFleet…`). Derived fields (`state`,
`openAlertCount`, `nextService`, `lastReportedAt`, `documentStatus`, 30-day stats, `urgency`,
`remainingDays`, `remainingKm`, `maneuverCount`, `durationSeconds`, `inProgress`,
`measurementUnit`) are selected only on root list/detail queries; nested relations select the
stored `…Ref` fields (`FleetVehicleRef { id licensePlate fleetNumber vehicleType status }`,
`FleetDriverRef { id firstName lastName employeeNumber status }`, `FleetVehicleGroupRef { id name
colorToken }`). The single documented exception (backend 2.3) is `FleetVehicle.nextService`: a full
`FleetServiceTask` attached by the vehicles service from the batched `nextForVehicles`, so vehicle
operations may select its `urgency remainingDays remainingKm`. Variables are typed from the
generated `…QueryVariables`; client scalars `DateTime`/`Date` are strings (backend 8.3).

`features/fleet/shared/operations.graphql`:

```graphql
query AdminFleetDataClock {
  fleetDataClock {
    asOf
    businessDate
    timeZone
  }
}
query AdminFleetVehicleOptions($search: String, $ids: [ID!], $filter: FleetVehicleFilter) {
  fleetVehicles(
    offset: 0
    limit: 20
    search: $search
    ids: $ids
    filter: $filter
    sort: { field: LICENSE_PLATE, direction: ASC }
  ) {
    items {
      id
      licensePlate
      fleetNumber
      vehicleType
      status
    }
    total
  }
}
query AdminFleetDriverOptions($search: String, $ids: [ID!], $filter: FleetDriverFilter) {
  fleetDrivers(
    offset: 0
    limit: 20
    search: $search
    ids: $ids
    filter: $filter
    sort: { field: LAST_NAME, direction: ASC }
  ) {
    items {
      id
      firstName
      lastName
      employeeNumber
      status
    }
    total
  }
}
query AdminFleetGroupOptions {
  fleetVehicleGroups(offset: 0, limit: 100, sort: { field: NAME, direction: ASC }) {
    items {
      id
      name
      colorToken
    }
    total
  }
}
```

Shared files:

| File                                 | Content                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fleet-scope.ts`                     | `FleetScope`, `injectFleetScope()`                                                                                                                                                                                                                                                                                         |
| `fleet-enums.ts`                     | `as const` arrays for every Fleet enum with compile-time exhaustiveness checks against the generated unions (no casts); `maneuverKinds` (first nine `FleetEventKind` values)                                                                                                                                               |
| `fleet-tones.ts`                     | Enum → `StatusTone` maps (table below) and `scoreTone(score)` with the only client presentation constants `SCORE_GOOD_MIN = 85` and `SCORE_FAIR_MIN = 70` (5.1)                                                                                                                                                            |
| `vehicle-detail-context.ts`          | `VehicleDetailContext` and the `VEHICLE_DETAIL` injection token shared by the vehicle detail page and its tabs (5.5)                                                                                                                                                                                                       |
| `fleet-time.ts`                      | `fleetTimeZone = 'Europe/Sofia'`, `periodRange(period, asOf, from, to)` → half-open DateTime range, `isStale(asOf, now)` (> 48 h)                                                                                                                                                                                          |
| `fleet-format.ts`                    | `vehicleLabel(ref)` ("CA 1234 AB · Т-01"), `driverName(ref)`, `measured(value, threshold, unit, language)` ("128 / 90 км/ч"), `mapLink(lat, lon)` (OpenStreetMap URL only for a finite pair within bounds, opened on click in a new tab with `rel="noopener noreferrer"`)                                                  |
| `data-clock.ts`                      | `FleetDataClockChip` presentational component (`holita-fleet-data-clock`; input: the `AdminFleetDataClock` result): "Данни към 18.10.2026 09:30" chip; "Няма телеметрия" when `asOf` is null; stale `p-message warn` when `WALL_CLOCK() − asOf > 48 h` ("Данните са по-стари от 48 часа; демо данните са към 18.10.2026.") |
| `fleet-options.ts`                   | Option label mappers for pickers (`{ id, label, detail }`)                                                                                                                                                                                                                                                                 |
| `i18n/bg.json, en.json, messages.ts` | Shared Fleet catalog (6.1)                                                                                                                                                                                                                                                                                                 |

| Enum                                | Tones                                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FleetVehicleStatus`                | ACTIVE success · IN_WORKSHOP warn · INACTIVE neutral                                                                                                             |
| `FleetActivityStatus`               | MOVING success · IDLE warn · PARKED info · ASSET category C4 · NOT_CONNECTED danger · NO_DEVICE neutral (dots use `tone.*.solid`)                                |
| `FleetFuelStatus`                   | LOW danger · STALE neutral ("остаряло") · NO_DATA neutral ("няма данни") · NORMAL no tag (meter bar only)                                                        |
| `FleetEventSeverity`                | CRITICAL danger · WARNING warn · INFO info                                                                                                                       |
| `FleetAlertStatus`                  | OPEN accent · ACKNOWLEDGED info · RESOLVED neutral                                                                                                               |
| `FleetServiceUrgency`               | OVERDUE danger · DUE_SOON warn · UNKNOWN_ODOMETER neutral · UPCOMING info                                                                                        |
| `FleetServiceStatus`                | PLANNED info · DONE success · CANCELLED neutral                                                                                                                  |
| `FleetDocumentStatus`               | EXPIRED danger · EXPIRING warn · VALID success · NOT_RECORDED neutral                                                                                            |
| `FleetDriverStatus`                 | ACTIVE success · ON_LEAVE warn · INACTIVE neutral                                                                                                                |
| `FleetAttentionReason`              | CRITICAL_ALERT danger · NOT_CONNECTED danger · SERVICE_OVERDUE warn · LOW_FUEL warn · DRIVER_DOCUMENT_EXPIRED warn · WARNING_ALERTS warn                         |
| Scores (`drivingScore`, `ecoScore`) | `scoreTone`: ≥ 85 success · ≥ 70 and < 85 warn · < 70 danger · null "—" with tooltip "Устройството няма SAFETY_SF"; labelled "демо оценка 0–100 от устройството" |

### 5.1 Clocks, units and nulls (every Fleet screen)

- Telemetry (activity, last report, positions, trips, events, distance, scores, fuel) is shown
  against the data clock: relative ages use `formatRelative(value, asOf)`; every telemetry page
  header shows the `FleetDataClockChip`; KPI windows show their `windowStart`–`windowEnd`.
- Business dates (document expiry, service due/remaining days, cost windows) show the backend's
  values (`businessDate`, `remainingDays`) and are never recomputed in the browser.
- Write timestamps (`acknowledgedAt`, `resolvedAt`, `createdAt`, `updatedAt`) are absolute Sofia
  time.
- All instants display in `Europe/Sofia`; date-only values display without zone conversion.
- `null` is "—" (or the catalog's explicit "няма данни"); `0` is a number. Fuel `null` is never 0 %.
  Coordinates `0/0` display as-is and produce a map link; null coordinates produce none.
- Units are holita's demo contract (km, km/h, L, V, °C, min, %, 0–100, EUR). No Karma equivalence.
- The UI never classifies telemetry itself: activity, fuel status, urgency, document status,
  attention reasons and whether a trip without end is still in progress (`FleetTrip.inProgress`)
  come from the API. Exactly two client rules exist, both presentation-only and both in one place:
  the 48 h stale banner (`isStale` in `fleet-time.ts`, wall clock vs `asOf`) and the score tone
  bands (`scoreTone` in `fleet-tones.ts`, 85/70), which colour a device-reported score and never
  change what the API reports.

### 5.2 Overview (`overview/`, landing, B3)

Route `fleet/overview`; `OverviewPage` owns one client and eight watch queries; each card renders
its own loading skeleton, error (`EmptyState kind="error"` compact + Retry that refetches only that
query, last values retained) and empty state.

Header: eyebrow "Флот · <Branch>", title "Преглед", description "Какво изисква внимание днес",
`[headerMeta]` data-clock chip + `p-tag` "Демо данни" (neutral), action "Обнови" (icon button,
refetches all queries).

Layout (`.app-card-grid` areas; 3 columns ≥ `xl`, 2 at `md`–`xl`, 1 below `md`):

```text
"kpi       kpi       kpi"
"attention attention activity"
"distance  distance  usage"
"trips     trips     documents"
"trips     trips     groups"
```

| Card                | Operation                                                                   | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI strip (6 tiles) | `AdminFleetOverviewKpis`                                                    | 1 Operational vehicles: `operational` of `total`, secondary "в сервиз: inWorkshop" linking to `vehicles?statuses=IN_WORKSHOP`. 2 Reporting 48 h: `reporting48h.value` as %, footnote "numerator от denominator с устройство", secondary "без устройство: operationalWithoutDevice". 3 Open alerts: `alerts.open`, badge "критични: openCritical" (danger), secondary "нови за 24 ч: newAlerts24h", link `alerts`. 4 Service: `service.overdue` (danger tone), secondary "скоро: dueSoon", link `maintenance?view=overdue`. 5 Distance 7 d: `distance7dKm.value` km, delta against `previousValue` (neutral sentiment), footnote "coveredCount от eligibleCount курса с разстояние". 6 Average driving score 7 d: value (1 decimal), delta (up = good), footnote "coveredCount от eligibleCount курса с оценка", explanation "Σ(оценка × км) ÷ Σ км; курсове ≥ 0,5 км". Every explanation states the formula and the window; `value: null` renders "—" with "Няма данни за периода" or "Няма знаменател". |
| Needs attention     | `AdminFleetAttention(limit: 10)`; "Покажи всички (total)" refetches with 50 | TablePanel (h2). Columns: vehicle (plate link to the detail + fleet number), primary reason tag, other reasons as compact tags (+n), since (`occurredAt` relative to `asOf`, or "—"), action link by reason: CRITICAL_ALERT/WARNING_ALERTS → `vehicles/:id/alerts`, SERVICE_OVERDUE → `vehicles/:id/service`, others → `vehicles/:id/overview`. Empty: `EmptyState kind="done"` "Нищо не изисква внимание".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Activity now        | `AdminFleetActivity`                                                        | `p-metergroup` (six statuses in enum order, `tone.*.solid` colours) and a legend with counts and percentages of `total` (operational vehicles), "към <asOf>"; never labelled "live".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Distance, 14 days   | `AdminFleetDailyDistance(days: 14)`                                         | `ColumnSeries` with Sofia dates (weekday initials), last day highlighted, header total of the 14 days; empty when `days` is empty (`asOf` null).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Use and safety, 7 d | `AdminFleetOverviewKpis` (same query)                                       | Utilisation (`utilization7d` %, "x от y превозни средства"), maneuvers per 100 km (`maneuversPer100Km7d`, delta up = bad), fuel economy L/100 km (`fuelEconomy7dLPer100Km`, "от coveredCount от eligibleCount превозни средства"), low-fuel vehicles (`lowFuelVehicles`, danger tone when > 0), documents expired/expiring with link `drivers?documentsExpireWithinDays=30`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Recent trips        | `AdminFleetRecentTrips`                                                     | Compact table: start, vehicle, driver, from → to, distance, score tag; rows link to `trips/:id`; footer link "Всички курсове".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Expiring documents  | `AdminFleetExpiringDocuments(withinDays: 30, limit: 10)`                    | Driver (link to the scorecard), document type, expiry date, status tag, assigned plates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Groups              | `AdminFleetGroupBreakdown`                                                  | `StackedBars`, one row per group (category colour, count) plus "Без група"; rows link to `vehicles?groupIds=<id>` and `vehicles?hasGroup=false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Header clock        | `AdminFleetDataClock` (shared)                                              | Chip and stale banner.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

`overview/operations.graphql`:

```graphql
fragment AdminFleetMetric on FleetMetric {
  value
  numerator
  denominator
  previousValue
  windowStart
  windowEnd
  coveredCount
  eligibleCount
}
query AdminFleetOverviewKpis {
  fleetOverviewKpis {
    asOf
    businessDate
    vehicles {
      total
      operational
      inWorkshop
      inactive
      operationalWithoutDevice
    }
    reporting48h {
      ...AdminFleetMetric
    }
    alerts {
      open
      openCritical
      acknowledged
      resolved
    }
    newAlerts24h
    service {
      businessDate
      overdue
      dueSoon
      unknownOdometer
      upcoming
      inWorkshopVehicles
      completedLast30Days
      costLast30DaysCents
      costWindowStart
      costWindowEnd
    }
    documents {
      businessDate
      expired
      expiring
    }
    lowFuelVehicles
    distance7dKm {
      ...AdminFleetMetric
    }
    utilization7d {
      ...AdminFleetMetric
    }
    averageDrivingScore7d {
      ...AdminFleetMetric
    }
    maneuversPer100Km7d {
      ...AdminFleetMetric
    }
    fuelEconomy7dLPer100Km {
      ...AdminFleetMetric
    }
  }
}
query AdminFleetActivity {
  fleetActivity {
    asOf
    total
    counts {
      activity
      count
    }
  }
}
query AdminFleetDailyDistance($days: Int!) {
  fleetDailyDistance(days: $days) {
    asOf
    days {
      date
      distanceKm
      tripCount
    }
  }
}
query AdminFleetAttention($limit: Int!) {
  fleetAttention(limit: $limit) {
    asOf
    businessDate
    total
    items {
      vehicle {
        id
        licensePlate
        fleetNumber
        vehicleType
        status
      }
      primaryReason
      reasons
      occurredAt
    }
  }
}
query AdminFleetExpiringDocuments($withinDays: Int!, $limit: Int!) {
  fleetExpiringDocuments(withinDays: $withinDays, limit: $limit) {
    businessDate
    total
    items {
      driver {
        id
        firstName
        lastName
        employeeNumber
        status
      }
      document
      expiresOn
      status
      assignedVehicles {
        id
        licensePlate
        fleetNumber
        vehicleType
        status
      }
    }
  }
}
query AdminFleetRecentTrips {
  fleetTrips(offset: 0, limit: 8, sort: { field: STARTED_AT, direction: DESC }) {
    items {
      id
      vehicle {
        id
        licensePlate
        fleetNumber
        vehicleType
        status
      }
      driver {
        id
        firstName
        lastName
        employeeNumber
        status
      }
      startedAt
      endedAt
      startAddress
      endAddress
      distanceKm
      drivingScore
    }
    total
    totalDistanceKm
  }
}
query AdminFleetGroupBreakdown {
  fleetVehicleGroups(offset: 0, limit: 100, sort: { field: NAME, direction: ASC }) {
    items {
      id
      name
      colorToken
      vehicleCount
    }
    total
    ungroupedVehicleCount
  }
}
```

States: first load per card; **empty Branch** (Sandbox: `vehicles.total = 0`) replaces the cards
with an onboarding `EmptyState` ("Добавете първото превозно средство" → `vehicles/new`, "Добавете
устройство" → `devices/new`); **no telemetry** (`asOf` null, vehicles exist): telemetry tiles and
cards show "—" with "Няма телеметрия" while counts, service and documents still render; **stale**
banner; **partial error** (one card fails, others render); Fleet disabled / unknown Branch handled
by FleetWorkspace. Mobile: KPI strip 2 columns; cards stacked; attention table scrolls inside its
panel with the vehicle column sticky.

### 5.3 Alerts (`alerts/`, B2)

Route `fleet/alerts`, drawer `fleet/alerts/:recordId`. Header: eyebrow "Наблюдение", title
"Аларми", count = list total, description "Сигнали от устройствата, които изискват действие",
data-clock chip.

**Segments** (`p-selectbutton` in `[filterSegments]`, URL `status=open|acknowledged|resolved|all`,
default `open`): labels with counts from `AdminFleetAlertCounts($search, $filter)` called with the
current search and non-status filters (search, severity, kinds, vehicles, period, but not
`alertStatuses`/`actionable`), so each count equals the total the list shows for that segment.

**Filters** (URL params = filter fields unless noted): `search` (plate, fleet number, driver, address,
trouble code); `severities` (multiselect); `kinds` (multiselect grouped: Driving = nine maneuver
kinds, Fuel = LOW_FUEL/FUEL_DROP/IDLING, Power = POWER_DISCONNECTED/LOW_BACKUP_BATTERY, Device =
CAN_DISCONNECTED/DEVICE_OFFLINE/IGNITION_ON/IGNITION_OFF, Diagnostics = DIAGNOSTIC_TROUBLE_CODE,
Safety = CRASH_DETECTED); `vehicleIds` (autocomplete multiple, ≤ 20, `AdminFleetVehicleOptions`);
`period` (`24h|7d|30d|custom`, default none) with `from`/`to` dates → `occurredFrom/occurredTo`
relative to `asOf`. Variables always include `actionable: true`; `alertStatuses` from the segment
(none for `all`).

**Sorts**: `OCCURRED_AT` (default DESC), `SEVERITY` (column header sort; DESC first).

**Columns**: selection checkbox; severity (dot + tag); kind (label, `troubleCode` in mono below);
vehicle (plate link to the vehicle detail); driver ("—" when null); occurred (relative to `asOf`,
tooltip absolute);
location (`address`, truncated, `.app-col-secondary`); measured/threshold with unit
(`measured()`); status tag; remark excerpt (`.app-col-secondary`). The first-column link and a row
click open `alerts/:id` (preserving query).

**Bulk actions** (bulk bar): "Потвърди" (only rows with OPEN; others skipped with a count) and
"Разреши" (OPEN/ACKNOWLEDGED), run with `runSequential` sending `expectedStatus` = the row's status
and no remark; CONFLICT/NOT_FOUND rows stay selected; notice "Потвърдени: 3. Неуспешни: 1 (променени
от друг оператор)."; one refetch of list and counts.

**Operations** (`alerts/operations.graphql`):

```graphql
fragment AdminFleetAlertRow on FleetEvent {
  id
  vehicleId
  vehicle {
    id
    licensePlate
    fleetNumber
    vehicleType
    status
  }
  tripId
  driverId
  driver {
    id
    firstName
    lastName
    employeeNumber
    status
  }
  occurredAt
  kind
  severity
  intensity
  address
  speedKph
  measuredValue
  thresholdValue
  measurementUnit
  troubleCode
  alertStatus
  acknowledgedAt
  resolvedAt
  remark
  updatedAt
}
fragment AdminFleetAlertDetail on FleetEvent {
  ...AdminFleetAlertRow
  deviceImei
  source
  latitude
  longitude
  details
  createdAt
}
query AdminFleetAlerts(
  $offset: Int!
  $limit: Int!
  $search: String
  $filter: FleetEventFilter
  $sort: FleetEventSort
) {
  fleetEvents(offset: $offset, limit: $limit, search: $search, filter: $filter, sort: $sort) {
    items {
      ...AdminFleetAlertRow
    }
    total
    offset
    limit
  }
}
query AdminFleetAlertCounts($search: String, $filter: FleetEventFilter) {
  fleetAlertCounts(search: $search, filter: $filter) {
    open
    openCritical
    acknowledged
    resolved
  }
}
query AdminFleetAlert($id: ID!) {
  fleetEvent(id: $id) {
    ...AdminFleetAlertDetail
  }
}
query AdminFleetAlertTimeline($tripId: ID!) {
  fleetEvents(
    offset: 0
    limit: 100
    filter: { tripIds: [$tripId] }
    sort: { field: OCCURRED_AT, direction: ASC }
  ) {
    items {
      id
      occurredAt
      kind
      severity
      intensity
      alertStatus
      speedKph
      measuredValue
      thresholdValue
      measurementUnit
    }
    total
  }
}
mutation AdminFleetAcknowledgeAlert($id: ID!, $input: FleetAlertTransitionInput!) {
  acknowledgeFleetAlert(id: $id, input: $input) {
    ...AdminFleetAlertDetail
  }
}
mutation AdminFleetResolveAlert($id: ID!, $input: FleetAlertTransitionInput!) {
  resolveFleetAlert(id: $id, input: $input) {
    ...AdminFleetAlertDetail
  }
}
mutation AdminFleetReopenAlert($id: ID!, $input: FleetAlertTransitionInput!) {
  reopenFleetAlert(id: $id, input: $input) {
    ...AdminFleetAlertDetail
  }
}
```

**Alert drawer** (`AlertDrawer`, size `md`, workflow drawer, used under Alerts, the vehicle Alerts
tab): title = kind label, subtitle "<plate> · <occurred absolute>", meta tags severity + status.
Body: facts (occurred, vehicle link, driver, trip link to `trips/:tripId` when `tripId`, location
with map link, speed, measured/threshold/unit, intensity 1–3, trouble code verbatim mono, details as
escaped text, device IMEI mono, source, acknowledged/resolved times); "Събития от курса" `p-timeline`
from `AdminFleetAlertTimeline` (current event highlighted; hidden without `tripId`); remark
`textarea` (FormField with counter, ≤ 1000 code points, NUL rejected). Footer by status: OPEN →
"Разреши" (secondary) + "Потвърди" (primary); ACKNOWLEDGED → "Разреши" (primary); RESOLVED →
"Отвори отново" (secondary). Each sends `{ expectedStatus: <loaded status>, remark }` where
`remark` is omitted when unchanged, `null` when cleared. Success → host notice ("Алармата е
потвърдена.") and close. CONFLICT → drawer message "Алармата е променена от друг оператор." with
"Презареди" (refetch, remark draft kept). BAD_USER_INPUT on `expectedStatus` → drawer-level
message; on `remark` → field. NOT_FOUND / invalid UUID → not-found state. Dirty guard when the
remark changed.

States: loading, inbox zero (`EmptyState kind="done"` "Няма отворени аларми"), no results + clear,
first-load error, retained-rows error, bulk progress and partial failure, drawer saving/conflict/
not-found, 1,000-character Cyrillic remark, URL-backed filters and paging. Mobile (< `sm`): the
table is replaced by a card list (same data, one card per alert: severity dot, kind, plate, relative
time, status; tap opens the drawer; selection via a checkbox on each card); bulk bar full width.

### 5.4 Vehicles (`vehicles/`, B1 + B2 fields)

Route `fleet/vehicles`; drawers `new`, `:recordId/edit`. Header: eyebrow "Автопарк", title
"Превозни средства", count, description "Всички превозни средства в клона", actions "Ново превозно
средство" (primary, `new`), refresh icon.

**KPI strip** (`AdminFleetVehicleSummary`, aliases over the standard list, `limit: 1`, `total` only):

```graphql
query AdminFleetVehicleSummary {
  operational: fleetVehicles(offset: 0, limit: 1, filter: { statuses: [ACTIVE, IN_WORKSHOP] }) {
    total
  }
  inWorkshop: fleetVehicles(offset: 0, limit: 1, filter: { statuses: [IN_WORKSHOP] }) {
    total
  }
  withoutDevice: fleetVehicles(
    offset: 0
    limit: 1
    filter: { statuses: [ACTIVE, IN_WORKSHOP], hasDevice: false }
  ) {
    total
  }
  withOpenAlerts: fleetVehicles(
    offset: 0
    limit: 1
    filter: { statuses: [ACTIVE, IN_WORKSHOP], hasOpenAlerts: true }
  ) {
    total
  }
}
```

Tiles link to the matching filter (`statuses=ACTIVE,IN_WORKSHOP`, `statuses=IN_WORKSHOP`,
`statuses=ACTIVE,IN_WORKSHOP&hasDevice=false`, `…&hasOpenAlerts=true`). "Not connected" is not a
tile: activity is derived and not a list filter (backend 3.5); the Overview shows it.

**Filters**: `search` (plate, fleet number, VIN, make, model; hint shows the fields and that Latin
and Cyrillic letters differ); `statuses`, `vehicleTypes`, `fuelTypes` (multiselects); `groupIds`
(multiselect from `AdminFleetGroupOptions`) and `hasGroup` (option "Без група" in the same control
maps to `hasGroup=false`); `currentDriverIds` (autocomplete) and `hasDriver`; `hasDevice`
(selectbutton All/С устройство/Без устройство); `hasOpenAlerts` (toggle).

Mutually exclusive pairs (the backend ANDs every filter, backend 3.2, so mixing them would always
return nothing): in the group multiselect, "Без група" is the first option; choosing it clears the
selected groups and sets `hasGroup=false`, and choosing any group clears "Без група" (removes
`hasGroup`). `hasDriver` is a selectbutton All/С шофьор/Без шофьор; "Без шофьор" (`hasDriver=false`)
clears and disables the driver autocomplete, and choosing a driver resets it to All. The FilterBar
shows either the group chips or one "Без група" chip (and likewise for drivers). A URL that carries
both `groupIds` and `hasGroup=false` (or `currentDriverIds` and `hasDriver=false`) is normalised by
dropping `hasGroup`/`hasDriver` with `replaceUrl`, through the Vehicles list definition's
`normalizeFilter` (3.4); `vehicles-list.spec.ts` covers it.

**Sorts**: `LICENSE_PLATE`, `FLEET_NUMBER`, `CREATED_AT` (default DESC), `UPDATED_AT`; params
`licensePlate|fleetNumber|createdAt|updatedAt`. "Нулирай сортирането" when not default.

**Columns**: checkbox; plate (bold link to detail) over fleet number (`.app-cell-stack`, sticky);
type label over make/model; status tag; activity (dot + label) over last report relative to
`asOf` ("никога" when null); driver (avatar initials + name, link to scorecard; "—"); odometer
(`state.odometerKm`, "ръчно" marker when `odometerSource = MANUAL`); fuel (`.app-meter` bar with
percentage when `fuelStatus` NORMAL/LOW, LOW in danger tone; "остаряло"/"няма данни" text
otherwise — never computed from `fuelLevelPct`); open alerts (`p-badge` danger when > 0, link to
`vehicles/:id/alerts`); next service (urgency tag + due date/remaining); group (dot + name);
actions (edit icon → `:id/edit`, delete icon). Secondary columns (type, fuel, group, odometer) are
`.app-col-secondary`.

**Bulk**: "Деактивирай" (sequential `deactivateFleetVehicle`), "Изтрий" (confirm, sequential
`deleteFleetVehicle`; CONFLICT → per-row message "Има устройства или история; деактивирайте го.";
failed rows stay selected).

**Operations** (`vehicles/operations.graphql`, shared with the detail page):

```graphql
fragment AdminFleetVehicleRow on FleetVehicle {
  id
  licensePlate
  fleetNumber
  vehicleType
  make
  model
  status
  group {
    id
    name
    colorToken
  }
  currentDriver {
    id
    firstName
    lastName
    employeeNumber
    status
  }
  deviceCount
  openAlertCount
  state {
    activity
    lastReportedAt
    fuelLevelPct
    fuelStatus
    odometerKm
    odometerSource
  }
  nextService {
    id
    serviceType
    dueOn
    dueOdometerKm
    urgency
    remainingDays
    remainingKm
  }
  createdAt
  updatedAt
}
fragment AdminFleetVehicleEditorFields on FleetVehicle {
  id
  licensePlate
  notes
  fleetNumber
  vehicleType
  make
  model
  modelYear
  vin
  fuelType
  fuelTankCapacityL
  status
  groupId
  group {
    id
    name
    colorToken
  }
  currentDriverId
  currentDriver {
    id
    firstName
    lastName
    employeeNumber
    status
  }
  updatedAt
}
fragment AdminFleetVehicleDetail on FleetVehicle {
  ...AdminFleetVehicleEditorFields
  deviceCount
  openAlertCount
  createdAt
  state {
    activity
    lastReportedAt
    latitude
    longitude
    address
    speedKph
    headingDeg
    ignition
    fuelLevelPct
    fuelStatus
    externalVoltage
    backupBatteryVoltage
    engineHours
    coolantTempC
    odometerKm
    odometerRecordedAt
    odometerSource
  }
  nextService {
    id
    serviceType
    title
    dueOn
    dueOdometerKm
    urgency
    remainingDays
    remainingKm
    workshop
  }
}
query AdminFleetVehicles(
  $offset: Int!
  $limit: Int!
  $search: String
  $filter: FleetVehicleFilter
  $sort: FleetVehicleSort
) {
  fleetVehicles(offset: $offset, limit: $limit, search: $search, filter: $filter, sort: $sort) {
    items {
      ...AdminFleetVehicleRow
    }
    total
    offset
    limit
  }
}
# AdminFleetVehicleSummary is listed with the KPI strip above.
query AdminFleetVehicle($id: ID!) {
  fleetVehicle(id: $id) {
    ...AdminFleetVehicleDetail
  }
}
query AdminFleetVehicleEditor($id: ID!) {
  fleetVehicle(id: $id) {
    ...AdminFleetVehicleEditorFields
  }
}
query AdminFleetVehicleDevices($vehicleId: ID!) {
  fleetDevices(
    offset: 0
    limit: 20
    filter: { vehicleIds: [$vehicleId] }
    sort: { field: INSTALLED_AT, direction: DESC }
  ) {
    items {
      id
      imei
      model
      options
      firmwareVersion
      installedAt
      lastReportedAt
    }
    total
  }
}
query AdminFleetVehicleSamples($vehicleId: ID!, $from: DateTime!, $to: DateTime!) {
  fleetVehicleSamples(vehicleId: $vehicleId, from: $from, to: $to) {
    vehicleId
    from
    to
    truncated
    items {
      id
      recordedAt
      source
      speedKph
      fuelLevelPct
      externalVoltage
      odometerKm
    }
  }
}
query AdminFleetVehicleOpenAlerts($vehicleId: ID!) {
  fleetEvents(
    offset: 0
    limit: 5
    filter: { vehicleIds: [$vehicleId], alertStatuses: [OPEN] }
    sort: { field: SEVERITY, direction: DESC }
  ) {
    items {
      id
      occurredAt
      kind
      severity
      alertStatus
    }
    total
  }
}
mutation AdminFleetCreateVehicle($input: CreateFleetVehicleInput!) {
  createFleetVehicle(input: $input) {
    ...AdminFleetVehicleEditorFields
  }
}
mutation AdminFleetUpdateVehicle($id: ID!, $input: UpdateFleetVehicleInput!) {
  updateFleetVehicle(id: $id, input: $input) {
    ...AdminFleetVehicleEditorFields
  }
}
mutation AdminFleetDeactivateVehicle($id: ID!) {
  deactivateFleetVehicle(id: $id) {
    id
    status
    currentDriverId
  }
}
mutation AdminFleetDeleteVehicle($id: ID!) {
  deleteFleetVehicle(id: $id) {
    id
    licensePlate
  }
}
mutation AdminFleetRecordOdometer($input: RecordFleetOdometerReadingInput!) {
  recordFleetOdometerReading(input: $input) {
    id
    vehicleId
    recordedAt
    odometerKm
    source
  }
}
```

**Vehicle editor drawer** (`VehicleEditorDrawer`, `md`; list `new`/`:recordId/edit`, detail
`overview/edit`). Sections and rules (client validation mirrors backend 9.2; server is the authority):

| Section       | Field (control)                                                                                                                                                                                                                | Client rules                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Идентификация | `licensePlate`* (inputtext), `fleetNumber` (inputtext), `vin` (inputtext, upper-cased on blur), `vehicleType` (select)                                                                                                         | 1–32 / ≤ 16 / `^[A-HJ-NPR-Z0-9]{17}$` / enum                                                      |
| Спецификация  | `make`, `model` (inputtext), `modelYear` (inputnumber, no grouping), `fuelType` (select), `fuelTankCapacityL` (inputnumber)                                                                                                    | ≤ 64 / ≤ 64 / 1950–2100 / enum / 1–2000                                                           |
| Организация   | `status` (selectbutton ACTIVE/IN_WORKSHOP/INACTIVE), `groupId` (select with "Без група", `AdminFleetGroupOptions`), `currentDriverId` (autocomplete, `AdminFleetDriverOptions` with `statuses: [ACTIVE, ON_LEAVE]`, clearable) | INACTIVE requires no driver (error on `currentDriverId`: "Премахнете шофьора преди деактивиране") |
| Бележки       | `notes` (textarea, counter)                                                                                                                                                                                                    | ≤ 2,000                                                                                           |

Create sends only non-empty optional fields; update sends changed fields only (omitted = unchanged,
explicit `null` clears). Server field paths: `licensePlate notes fleetNumber vehicleType make model
modelYear vin fuelType fuelTankCapacityL status groupId currentDriverId`; duplicates (`fleetNumber`,
`vin`) arrive as `BAD_USER_INPUT` field errors. Success message "Превозното средство е запазено." /
"…е създадено.". Edit hydrates with `AdminFleetVehicleEditor` (network-only); states loading,
not-found, invalid ID, load error with Retry.

States: first load, Sandbox empty ("Добавете първото превозно средство" CTA), no results (Cyrillic
"СА 7712 КН" vs Latin "CA7712KH" documented in the search hint), first-load error with request ID,
retained rows on refresh error, bulk partial failures, saved notice, 32-code-point plate and
2,000-code-point notes truncated with `title`. Mobile: panel scrolls horizontally, plate column
sticky, secondary columns hidden below `md`, bulk bar full width.

### 5.5 Vehicle detail (`vehicles/`, tabs from other folders, B2)

Route `fleet/vehicles/:vehicleId` → `overview` (default), `trips`, `alerts`, `service`.
`VehicleDetailPage` owns `AdminFleetVehicle` (header + Overview tab data) and `AdminFleetDataClock`
and exposes them to its tabs only through the shared token (S, F2,
`features/fleet/shared/vehicle-detail-context.ts`):

```ts
export interface VehicleDetailSummary {
  readonly id: string;
  readonly licensePlate: string;
  readonly fleetNumber: string | null;
  readonly vehicleType: FleetVehicleType | null; // generated GraphQL types
  readonly status: FleetVehicleStatus;
}
export interface VehicleDetailContext {
  readonly vehicleId: string;
  /** null while loading or when the vehicle was not found. */
  readonly vehicle: Signal<VehicleDetailSummary | null>;
  /** Refetches the page's vehicle (header, nextService, openAlertCount). */
  reload(): void;
}
export const VEHICLE_DETAIL = new InjectionToken<VehicleDetailContext>('VEHICLE_DETAIL');
```

`VehicleDetailPage` implements `VehicleDetailContext` and declares
`providers: [{ provide: VEHICLE_DETAIL, useExisting: VehicleDetailPage }]`; components routed
into its outlet (the tabs and their drawers) `inject(VEHICLE_DETAIL)`. No tab imports
`VehicleDetailPage` or another feature's page, so G3/G4 compile against the F2 stub of the page.

Header: back link "Превозни средства" (`vehicles` with no query), eyebrow "<fleetNumber> ·
<type> · <group>", title plate, `[headerMeta]` status tag + activity tag + data-clock chip,
actions "Редактирай" (`overview/edit`), "Показание на километража" (`overview/odometer`, disabled
for INACTIVE), "Планирай обслужване" (`service/new`, disabled for INACTIVE). `p-tabs` with
`routerLink` tabs: Преглед, Курсове, Аларми (badge `openAlertCount` when > 0), Обслужване.

**Overview tab** (`VehicleOverviewTab`, vehicles folder; own client for devices/samples/open alerts;
hosts `edit` and `odometer` drawers with `saved` → `inject(VEHICLE_DETAIL).reload()`):

| Card                | Data                                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Последно състояние  | Facts from `state`: activity, last report (absolute + relative to `asOf`), address + map link, speed, heading, ignition, fuel meter + `fuelStatus`, external and backup voltage, odometer + source + `odometerRecordedAt`, engine hours, coolant                                                     |
| Последни 48 часа    | Three `Sparkline`s (speed km/h, fuel %, external V; no threshold lines: low fuel is the API's `fuelStatus`) from `AdminFleetVehicleSamples` with `from = asOf − 48 h`, `to = asOf + 1 ms` (half-open ranges); MANUAL samples (odometer only) are omitted from these series; `truncated` shows a note |
| Шофьор              | Current driver card (name link to scorecard, employee number, status); "Няма шофьор" with an edit link                                                                                                                                                                                               |
| Устройства          | Mini table from `AdminFleetVehicleDevices` (IMEI mono, model tag, option chips, firmware, last report "никога"); action "Добави устройство" → `/…/fleet/devices/new?vehicleId=<id>`                                                                                                                  |
| Отворени аларми     | Up to 5 from `AdminFleetVehicleOpenAlerts`; each links to `alerts/<alertId>` (tab drawer); link "Всички аларми"                                                                                                                                                                                      |
| Следващо обслужване | `nextService` (type, title, due date/km, urgency tag, workshop) → link `service`                                                                                                                                                                                                                     |
| Спецификация        | VIN mono, make/model/year, fuel type/tank, group, notes (pre-wrap), created/updated                                                                                                                                                                                                                  |

Detail states: loading; not found / invalid ID (`EmptyState kind="not-found"` with back link);
`NO_DEVICE` (telemetry cards replaced by `EmptyState kind="no-telemetry"` + "Добави устройство");
`NOT_CONNECTED` (warn banner "Няма връзка от <relative>"); INACTIVE (neutral banner "Неактивно;
историята е запазена", odometer/service actions disabled); two devices with one never reported;
zero vs null readings; coordinates 0/0 shown with a link; null coordinates without; each card and
tab fails independently.

**Odometer drawer** (`OdometerDrawer`, `md`): shows the latest odometer (value, time, source). Fields:
`odometerKm` (inputnumber, 1 decimal, ≥ latest value), `recordedAt` (datepicker with time, Sofia
wall time). The upper bound is `min(asOf ?? now, now)` (backend 9.6, `now` from `WALL_CLOCK`); the
value must be strictly after `state.odometerRecordedAt`; the default is the upper bound. When the
latest reading is at or after the upper bound (a device reports the odometer up to the data clock),
the drawer shows an info message ("Устройството вече отчита километража към <time>; ръчно показание
не е възможно.") and disables saving. Hint: "Ръчното показание променя само километража; не влияе
на активността, горивото или датата на данните." Mutation `AdminFleetRecordOdometer` with
`{ vehicleId, odometerKm, recordedAt }`; server paths `vehicleId`, `odometerKm`, `recordedAt`.

**Trips tab** (`VehicleTripsTab`, trips folder): the trips table (5.6) with fixed
`filter.vehicleIds = [vehicleId]`, its own URL state (period/sort/page) and `:recordId` drawer.
**Alerts tab** (`VehicleAlertsTab`, alerts folder): the alerts table with `vehicleIds` fixed,
segments with counts, `:recordId` drawer. **Service tab** (`VehicleServiceTab`, maintenance
folder): planned tasks table (urgency order) + history `p-timeline` (DONE/CANCELLED, completedOn
desc, cost, workshop, replaced parts) and drawers `new` (vehicle fixed), `:recordId/edit`,
`:recordId/complete`; it disables "new" while `VEHICLE_DETAIL.vehicle()?.status` is `INACTIVE` and
calls `VEHICLE_DETAIL.reload()` after a completion, cancellation or deletion so `nextService`
refreshes. Tab components reuse their feature's presentational table component; they never import
from another feature's page (only the shared token).

### 5.6 Trips (`trips/`, B2)

Route `fleet/trips`, read-only drawer `trips/:recordId`. Header: eyebrow "Наблюдение", title
"Курсове" / "Trip log" (2.3 name collision rule), count, description "Курсове, отчетени от
устройствата", data-clock chip.

**Filters**: `period` selectbutton `today|7d|30d|custom` (default `7d`), relative to `asOf`
(Sofia dates: today = date(asOf); 7d = date(asOf) − 6 … date(asOf); 30d likewise); `custom` shows a
date-range `p-datepicker` (`from`, `to` date-only params). The range becomes `startedFrom` = Sofia
midnight of `from`, `startedTo` = Sofia midnight after `to` (backend 3.2: from inclusive, to
exclusive). With `asOf` null and a preset period the list shows `EmptyState kind="no-telemetry"`
without a request. Other filters: `search`, `vehicleIds` and `driverIds` (autocomplete multiple),
`drivingScoreBelow` (inputnumber 0–100, URL codec `codecs.number(0, 100, 1)`), `hasDriver=false`
toggle "Неидентифициран шофьор" (clears and disables `driverIds`, the same exclusivity as 5.4),
`scored` (select All/С оценка/Без оценка), `hasEnd` (select All/Завършени/Без край).

**Sorts**: `STARTED_AT` (default DESC), `DISTANCE_KM`, `DRIVING_SCORE`.

**Distance per day**: with the `7d` or `30d` preset and no other filter, a compact `ColumnSeries`
above the table shows `AdminFleetTripsDailyDistance($days: Int!)` →
`fleetDailyDistance(days: $days) { asOf days { date distanceKm tripCount } }` (7 or 30). The
aggregate is Branch-wide and unfiltered, so it is hidden as soon as any other filter or search is
applied (a caption says so).

**Columns**: start → end (date + time; both dates when the trip crosses midnight; "в движение" tag
when the API reports `inProgress`, "няма получен край" when `endedAt` is null and `inProgress` is
false); vehicle;
driver ("Неидентифициран"); from → to address (truncated, `.app-col-secondary`); distance; duration;
idle (`.app-col-secondary`); max speed; fuel L (`.app-col-secondary`); driving score tag; eco score
(`.app-col-secondary`); maneuvers. `[panelFooter]`: "Σ <totalDistanceKm> км в <total> курса".

**Operations** (`trips/operations.graphql`):

```graphql
fragment AdminFleetTripRow on FleetTrip {
  id
  vehicleId
  vehicle {
    id
    licensePlate
    fleetNumber
    vehicleType
    status
  }
  driverId
  driver {
    id
    firstName
    lastName
    employeeNumber
    status
  }
  startedAt
  endedAt
  durationSeconds
  startAddress
  endAddress
  distanceKm
  idleSeconds
  maxSpeedKph
  fuelUsedL
  drivingScore
  ecoScore
  maneuverCount
  inProgress
}
fragment AdminFleetTripDetail on FleetTrip {
  ...AdminFleetTripRow
  deviceImei
  source
  startLatitude
  startLongitude
  endLatitude
  endLongitude
  startOdometerKm
  endOdometerKm
  createdAt
}
query AdminFleetTrips(
  $offset: Int!
  $limit: Int!
  $search: String
  $filter: FleetTripFilter
  $sort: FleetTripSort
) {
  fleetTrips(offset: $offset, limit: $limit, search: $search, filter: $filter, sort: $sort) {
    items {
      ...AdminFleetTripRow
    }
    total
    offset
    limit
    totalDistanceKm
  }
}
query AdminFleetTrip($id: ID!) {
  fleetTrip(id: $id) {
    ...AdminFleetTripDetail
  }
}
query AdminFleetTripTimeline($tripId: ID!) {
  fleetEvents(
    offset: 0
    limit: 100
    filter: { tripIds: [$tripId] }
    sort: { field: OCCURRED_AT, direction: ASC }
  ) {
    items {
      id
      occurredAt
      kind
      severity
      intensity
      alertStatus
      address
      speedKph
      measuredValue
      thresholdValue
      measurementUnit
    }
    total
  }
}
query AdminFleetTripManeuvers($tripId: ID!) {
  fleetManeuverCounts(filter: { tripIds: [$tripId] }) {
    kind
    intensity1
    intensity2
    intensity3
    intensityUnknown
    total
  }
}
query AdminFleetTripsDailyDistance($days: Int!) {
  fleetDailyDistance(days: $days) {
    asOf
    days {
      date
      distanceKm
      tripCount
    }
  }
}
```

**Trip drawer** (`TripDrawer`, `lg`, read-only; under Trips, vehicle Trips tab, driver scorecard):
title "<plate> · <start date>", meta score tags. KPI strip (distance, duration, idle, max speed,
fuel L, driving/eco score; unscored "—" with tooltip). `StackedBars` of the nine maneuver kinds
(segments intensity 1/2/3/unknown using info/warn/danger/muted tones). Timeline (ignition on,
maneuvers, speeding, alerts with status tags, ignition off; "показани 100 от N" when truncated).
Start/end facts with addresses, map links, odometers, device IMEI, source. States: loading,
not found, in progress, no end received, zero-distance yard move, unscored, unidentified driver,
overnight, 1,120 km trip.

States: loading, empty period ("Няма курсове за периода"), no results, error, retained rows, pages up
to 100. Mobile: secondary columns hidden; footer wraps.

### 5.7 Drivers and scorecard (`drivers/`, B1 + B2 fields)

**Drivers list** `fleet/drivers`, drawers `new`, `:recordId/edit`. Header: eyebrow "Автопарк",
title "Шофьори", count, action "Нов шофьор". Filters: `search` (name, employee number,
identification key, phone), `statuses`, `licenseCategories` (multiselect), `documentsExpireWithinDays`
(URL codec `codecs.integer(0, 365)`; toggle "Документи изтичат до {days} дни": on whenever the
parameter is present and shows its value, turning it on writes 30, off removes it, so the Overview
link `drivers?documentsExpireWithinDays=30` and any other valid value survive), `hasVehicle`
(selectbutton). Sorts: `LAST_NAME`
(default ASC), `EMPLOYEE_NUMBER`, `LICENSE_EXPIRES_ON`, `TACHOGRAPH_CARD_EXPIRES_ON`, `CREATED_AT`.
Columns: checkbox; avatar initials + full name (link to scorecard) over employee number; status
tag; vehicles (plates, max 2 + "+n"); phone (`.app-col-secondary`); licence categories (chips);
documents (`documentStatus` tag) over the two dates (licence / card, plain); distance 30 d; trips
30 d (`.app-col-secondary`); maneuvers per 100 km 30 d ("—" when null); actions. Bulk: delete
(CONFLICT → "Шофьорът е назначен или има курсове; направете го неактивен.").

```graphql
fragment AdminFleetDriverRow on FleetDriver {
  id
  firstName
  lastName
  employeeNumber
  phone
  status
  licenseCategories
  licenseExpiresOn
  tachographCardExpiresOn
  documentStatus
  vehicles {
    id
    licensePlate
    fleetNumber
    vehicleType
    status
  }
  distance30dKm
  tripCount30d
  maneuversPer100Km30d
  createdAt
  updatedAt
}
fragment AdminFleetDriverEditorFields on FleetDriver {
  id
  firstName
  lastName
  employeeNumber
  identificationKey
  phone
  email
  licenseNumber
  licenseCategories
  licenseExpiresOn
  tachographCardNumber
  tachographCardExpiresOn
  status
  notes
  vehicles {
    id
    licensePlate
    fleetNumber
    vehicleType
    status
  }
  updatedAt
}
fragment AdminFleetDriverProfile on FleetDriver {
  ...AdminFleetDriverEditorFields
  documentStatus
}
query AdminFleetDrivers(
  $offset: Int!
  $limit: Int!
  $search: String
  $filter: FleetDriverFilter
  $sort: FleetDriverSort
) {
  fleetDrivers(offset: $offset, limit: $limit, search: $search, filter: $filter, sort: $sort) {
    items {
      ...AdminFleetDriverRow
    }
    total
    offset
    limit
  }
}
query AdminFleetDriverEditor($id: ID!) {
  fleetDriver(id: $id) {
    ...AdminFleetDriverEditorFields
  }
}
query AdminFleetDriverScorecard($driverId: ID!, $days: Int!) {
  fleetDriverScorecard(driverId: $driverId, days: $days) {
    asOf
    windowStart
    windowEnd
    distanceKm
    tripCount
    scoredTripCount
    averageDrivingScore
    averageEcoScore
    maneuverCount
    maneuversPer100Km
    lowConfidence
    maneuvers {
      kind
      intensity1
      intensity2
      intensity3
      intensityUnknown
      total
    }
    driver {
      ...AdminFleetDriverProfile
    }
  }
}
query AdminFleetDriverWorstTrips($driverId: ID!, $from: DateTime!, $to: DateTime!) {
  fleetTrips(
    offset: 0
    limit: 5
    filter: { driverIds: [$driverId], scored: true, startedFrom: $from, startedTo: $to }
    sort: { field: DRIVING_SCORE, direction: ASC }
  ) {
    items {
      id
      vehicle {
        id
        licensePlate
        fleetNumber
        vehicleType
        status
      }
      startedAt
      endedAt
      distanceKm
      drivingScore
      ecoScore
      maneuverCount
    }
    total
  }
}
mutation AdminFleetCreateDriver($input: CreateFleetDriverInput!) {
  createFleetDriver(input: $input) {
    ...AdminFleetDriverEditorFields
  }
}
mutation AdminFleetUpdateDriver($id: ID!, $input: UpdateFleetDriverInput!) {
  updateFleetDriver(id: $id, input: $input) {
    ...AdminFleetDriverEditorFields
  }
}
mutation AdminFleetDeleteDriver($id: ID!) {
  deleteFleetDriver(id: $id) {
    id
    firstName
    lastName
  }
}
```

**Driver editor drawer** (`md`): Самоличност (`firstName`_, `lastName`_ 1–64, `employeeNumber` ≤ 32,
`status` selectbutton; INACTIVE while vehicles are assigned → error on `status`), Контакт (`phone`
`^\+?[0-9 ]{6,20}$`, `email`), Свидетелство и тахограф (`licenseNumber` ≤ 32, `licenseCategories`
multiselect chips ≤ 10, `licenseExpiresOn` date, `tachographCardNumber` ≤ 16,
`tachographCardExpiresOn` date), Идентификация (`identificationKey` ≤ 32), Бележки (≤ 2,000).
Duplicate `employeeNumber`/`identificationKey` → field errors.

**Scorecard** `fleet/drivers/:driverId` (+ `profile/edit`, `trips/:recordId`; 4.1 explains why the
editor is not `edit`): header back link "Шофьори", eyebrow "<employeeNumber> · <status>", title full
name, meta status + `documentStatus` tags, action "Редактирай" → `profile/edit`. Period selectbutton
7/30 days (`days` URL param, `codecs.choice(['7', '30'], '30')`, default 30). KPI strip
(distance, trips "scored от total с оценка", maneuvers per 100 km, average driving score, average
eco score); `lowConfidence` → info message "По-малко от 5 курса — ниска достоверност". Cards:
maneuvers `StackedBars` (nine kinds × intensity); "Най-слаби курсове" table from
`AdminFleetDriverWorstTrips` with `from = windowStart + 1 ms`, `to = windowEnd + 1 ms` (reproduces
the backend window `(start, end]` with an inclusive/exclusive filter), rows open `trips/:id` here;
documents card (licence number/categories/expiry, card number/expiry, status); assigned vehicles.
States: no trips (D29), only unscored trips, low confidence (D33: 3 scored trips, backend storyline
m), INACTIVE with history, not found, loading/error per card, `asOf` null.

### 5.8 Maintenance (`maintenance/`, B2)

Route `fleet/maintenance`; drawers `new`, `:recordId/edit`, `:recordId/complete`. Header:
eyebrow "Поддръжка", title "Обслужване", count, action "Планирай обслужване".

**KPI strip** (`AdminFleetServiceSummary`): overdue (danger), due soon, unknown odometer, vehicles
in workshop, completed in 30 days, cost in 30 days (EUR from cents; window
`costWindowStart–costWindowEnd` in the explanation). Tile links:

| Tile                 | Link                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| Overdue              | `maintenance?view=overdue`                                                 |
| Due soon             | `maintenance?view=dueSoon`                                                 |
| Unknown odometer     | `maintenance?view=unknownOdometer`                                         |
| Vehicles in workshop | `vehicles?statuses=IN_WORKSHOP` (the Vehicles list; it is a vehicle count) |
| Completed in 30 days | `maintenance?view=completed&from=<costWindowStart>&to=<costWindowEnd>`     |
| Cost in 30 days      | same as "Completed in 30 days"                                             |

**Segments** (`view` param, `codecs.choice`, default `planned`): `planned` (`statuses: [PLANNED]`),
`overdue` (`urgencies: [OVERDUE]`), `dueSoon` (`urgencies: [DUE_SOON]`), `unknownOdometer`
(`urgencies: [UNKNOWN_ODOMETER]`), `completed` (`statuses: [DONE]`), `all` (no status filter).
Default sort `URGENCY ASC`, except `completed`, whose default is `COMPLETED_ON DESC` through
`viewDefaultSorts: { param: 'view', sorts: { completed: { field: 'COMPLETED_ON', direction: 'DESC' } } }`
(3.4). Changing the segment resets `sort`/`order` and the page. Filters: `search` (title, workshop,
plate, fleet number), `serviceTypes`, `vehicleIds` (autocomplete), and in `completed` a date range
`from`/`to` → `completedFrom`/`completedTo` (date-only, inclusive; `from = to` selects one day;
dropped when the segment changes). Sorts: `URGENCY`, `DUE_ON`, `COMPLETED_ON`, `CREATED_AT`.

**Columns**: vehicle (plate link + fleet number); service type label over title; due date with
remaining days ("след 9 дни" / "преди 2 дни" from `remainingDays`); due km with remaining km;
urgency tag (PLANNED only); workshop (`.app-col-secondary`); status tag; completed on; cost
(`formatMoneyCents`; `0` → "0,00 € · гаранция", `null` → "—"); actions: Complete (PLANNED),
Edit (PLANNED), Cancel (PLANNED, confirm), Delete (PLANNED/CANCELLED, confirm). CONFLICT on any
action → notice "Обслужването вече не е планирано; списъкът е обновен." + refetch.

```graphql
fragment AdminFleetServiceTaskRow on FleetServiceTask {
  id
  vehicleId
  vehicle {
    id
    licensePlate
    fleetNumber
    vehicleType
    status
  }
  serviceType
  status
  title
  dueOn
  dueOdometerKm
  completedOn
  completedOdometerKm
  workshop
  costCents
  urgency
  remainingDays
  remainingKm
  createdAt
  updatedAt
}
fragment AdminFleetServiceTaskDetail on FleetServiceTask {
  ...AdminFleetServiceTaskRow
  replacedParts
  notes
}
query AdminFleetServiceTasks(
  $offset: Int!
  $limit: Int!
  $search: String
  $filter: FleetServiceTaskFilter
  $sort: FleetServiceTaskSort
) {
  fleetServiceTasks(offset: $offset, limit: $limit, search: $search, filter: $filter, sort: $sort) {
    items {
      ...AdminFleetServiceTaskRow
    }
    total
    offset
    limit
  }
}
query AdminFleetServiceSummary {
  fleetServiceSummary {
    businessDate
    overdue
    dueSoon
    unknownOdometer
    upcoming
    inWorkshopVehicles
    completedLast30Days
    costLast30DaysCents
    costWindowStart
    costWindowEnd
  }
}
query AdminFleetServiceTask($id: ID!) {
  fleetServiceTask(id: $id) {
    ...AdminFleetServiceTaskDetail
  }
}
query AdminFleetServiceVehicle($id: ID!) {
  fleetVehicle(id: $id) {
    id
    licensePlate
    fleetNumber
    status
    state {
      odometerKm
      odometerRecordedAt
      odometerSource
    }
  }
}
mutation AdminFleetCreateServiceTask($input: CreateFleetServiceTaskInput!) {
  createFleetServiceTask(input: $input) {
    ...AdminFleetServiceTaskDetail
  }
}
mutation AdminFleetUpdateServiceTask($id: ID!, $input: UpdateFleetServiceTaskInput!) {
  updateFleetServiceTask(id: $id, input: $input) {
    ...AdminFleetServiceTaskDetail
  }
}
mutation AdminFleetCompleteServiceTask($id: ID!, $input: CompleteFleetServiceTaskInput!) {
  completeFleetServiceTask(id: $id, input: $input) {
    completed {
      ...AdminFleetServiceTaskDetail
    }
    next {
      ...AdminFleetServiceTaskDetail
    }
  }
}
mutation AdminFleetCancelServiceTask($id: ID!) {
  cancelFleetServiceTask(id: $id) {
    ...AdminFleetServiceTaskRow
  }
}
mutation AdminFleetDeleteServiceTask($id: ID!) {
  deleteFleetServiceTask(id: $id) {
    id
  }
}
```

**Service task editor drawer** (`md`; new/edit; vehicle fixed and read-only under the vehicle
Service tab): `vehicleId`* (autocomplete, `AdminFleetVehicleOptions` with `statuses: [ACTIVE,
IN_WORKSHOP]`), `serviceType`* (select), `title` ≤ 120, `dueOn` (date 2000–2100), `dueOdometerKm`
(integer 0–9,999,999, hint with the current odometer from `AdminFleetServiceVehicle`; "Няма
показание" makes km-based plans UNKNOWN_ODOMETER), `workshop` ≤ 128, `notes` ≤ 2,000; at least one
of due date/km (`requireOneOf`, error on `dueOn`). Editing is only offered while PLANNED; CONFLICT →
drawer message + Reload.

**Complete drawer** (`md`): task summary facts; `completedOn`* (date, ≤ `businessDate` from
`AdminFleetDataClock`, ≥ 2000-01-01), `completedOdometerKm` (integer), `costCents` (inputnumber
currency EUR, 2 decimals, converted to integer cents; empty = unknown, 0 = warranty with hint),
`workshop`, `replacedParts` ≤ 1,000, `notes`; toggle "Планирай следващо" → `nextDueOn` (after
`completedOn`), `nextDueOdometerKm` (> completed odometer when both), `nextTitle` ≤ 120. Server
paths: `completedOn completedOdometerKm costCents workshop replacedParts notes nextDueOn
nextDueOdometerKm nextTitle`. Success notice "Обслужването е завършено; следващото е планирано за
<date/km>." when `next` is present.

States: loading, empty ("Няма планирано обслужване"), no results, error, overdue by date/km/both,
UNKNOWN_ODOMETER, cancelled, cost null vs 0, validation errors, dirty guard.

### 5.9 Devices (`devices/`, B1 + B2 `lastReportedAt`)

Route `fleet/devices`, drawers `new` (`?vehicleId=` preselects), `:recordId/edit`. Header: eyebrow
"Автопарк", title "Устройства", count, action "Ново устройство". Filters: `search` (IMEI,
firmware, SIM phone, vehicle plate), `models`, `options` (multiselect, matches all), `vehicleIds`
(autocomplete). ("Never reported" is derived and not offered.) Sorts: `IMEI`, `INSTALLED_AT`,
`CREATED_AT` (default DESC). Columns: checkbox; IMEI (mono, leading zeros kept, link to edit
drawer); model tag + option chips (catalog short codes: 4G, SF, IRF, CAN, ID, GO, DS, eC, Wi-Fi,
Voice, Ant, RS232, Wiliot; full names in tooltips); vehicle (plate link to detail); firmware (mono);
SIM phone (`.app-col-secondary`); installed (date); last report (relative to `asOf`, "никога");
actions. Bulk: delete (confirm; history does not block).

```graphql
fragment AdminFleetDeviceRow on FleetDevice {
  id
  imei
  vehicleId
  vehicle {
    id
    licensePlate
    fleetNumber
    vehicleType
    status
  }
  model
  options
  firmwareVersion
  simPhoneNumber
  installedAt
  lastReportedAt
  createdAt
  updatedAt
}
fragment AdminFleetDeviceEditorFields on FleetDevice {
  id
  imei
  vehicleId
  vehicle {
    id
    licensePlate
    fleetNumber
    vehicleType
    status
  }
  model
  options
  firmwareVersion
  simPhoneNumber
  simIccid
  installedAt
  notes
  lastReportedAt
  updatedAt
}
query AdminFleetDevices(
  $offset: Int!
  $limit: Int!
  $search: String
  $filter: FleetDeviceFilter
  $sort: FleetDeviceSort
) {
  fleetDevices(offset: $offset, limit: $limit, search: $search, filter: $filter, sort: $sort) {
    items {
      ...AdminFleetDeviceRow
    }
    total
    offset
    limit
  }
}
query AdminFleetDeviceEditor($id: ID!) {
  fleetDevice(id: $id) {
    ...AdminFleetDeviceEditorFields
  }
}
mutation AdminFleetCreateDevice($input: CreateFleetDeviceInput!) {
  createFleetDevice(input: $input) {
    ...AdminFleetDeviceEditorFields
  }
}
mutation AdminFleetUpdateDevice($id: ID!, $input: UpdateFleetDeviceInput!) {
  updateFleetDevice(id: $id, input: $input) {
    ...AdminFleetDeviceEditorFields
  }
}
mutation AdminFleetDeleteDevice($id: ID!) {
  deleteFleetDevice(id: $id) {
    id
    imei
  }
}
```

**Device editor drawer** (`md`): `imei`* (exactly 15 digits, string), `vehicleId`* (autocomplete,
label "Превозно средство"), `model` (select), `options` (multiselect limited to the model's allowed
set from `devices/device-options.ts`, which restates backend 9.3; disabled without a model; changing
the model drops options that are no longer allowed and says so), `firmwareVersion`
`^[0-9A-Za-z._-]{1,32}$`, `simPhoneNumber` `^\+?[0-9]{6,19}$`, `simIccid` `^[0-9]{18,22}$`,
`installedAt` (datetime, ≤ wall clock), `notes`. Duplicate IMEI → field error; option/model mismatch
→ field error on `options`.

### 5.10 Vehicle groups (`vehicle-groups/`, B1)

Route `fleet/settings/groups`, drawers `new`, `:recordId/edit`. Header: eyebrow "Настройки",
title "Групи превозни средства", count, action "Нова група". TablePanel (search; sort `NAME`
default ASC, `CREATED_AT`): colour dot + name; vehicle count (link to `vehicles?groupIds=<id>`);
description; actions. `[panelFooter]`: "Без група: <ungroupedVehicleCount>" linking to
`vehicles?hasGroup=false`. Delete: confirm; CONFLICT → "Групата съдържа превозни средства;
преместете ги първо."

```graphql
fragment AdminFleetVehicleGroupRow on FleetVehicleGroup {
  id
  name
  description
  colorToken
  vehicleCount
  createdAt
  updatedAt
}
query AdminFleetVehicleGroups(
  $offset: Int!
  $limit: Int!
  $search: String
  $sort: FleetVehicleGroupSort
) {
  fleetVehicleGroups(offset: $offset, limit: $limit, search: $search, sort: $sort) {
    items {
      ...AdminFleetVehicleGroupRow
    }
    total
    offset
    limit
    ungroupedVehicleCount
  }
}
query AdminFleetVehicleGroup($id: ID!) {
  fleetVehicleGroup(id: $id) {
    ...AdminFleetVehicleGroupRow
  }
}
mutation AdminFleetCreateVehicleGroup($input: CreateFleetVehicleGroupInput!) {
  createFleetVehicleGroup(input: $input) {
    ...AdminFleetVehicleGroupRow
  }
}
mutation AdminFleetUpdateVehicleGroup($id: ID!, $input: UpdateFleetVehicleGroupInput!) {
  updateFleetVehicleGroup(id: $id, input: $input) {
    ...AdminFleetVehicleGroupRow
  }
}
mutation AdminFleetDeleteVehicleGroup($id: ID!) {
  deleteFleetVehicleGroup(id: $id) {
    id
    name
  }
}
```

**Group drawer** (`md`): `name`* 1–64 (duplicate → field error), `description` ≤ 500, `colorToken`
(`p-selectbutton` of eight swatches rendered from `--p-app-category-c1…c8`, accessible names
"Цвят 1"…"Цвят 8", default C1). States: empty, empty group (0 vehicles), duplicate name, delete
blocked, dirty guard.

## 6. Internationalisation

### 6.1 Catalog layout

| Catalog                                                      | Owner        | Content                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/i18n/{bg,en}.json` + `messages.ts` (existing)           | DS           | Shell, login, workspace, common words, all Karma keys (unchanged). Fleet keys (`vehicles…`, `devices…`, `imei…`, relation picker) are removed in F2 once unused                                                                                                                                                                                                                                                                                   |
| `app/ui/i18n/{bg,en}.json` + `messages.ts`                   | DS           | Pattern texts: table states, page report, bulk bar, filter bar, drawer buttons and discard dialog, empty states, units, relative-time words, validator messages                                                                                                                                                                                                                                                                                   |
| `features/fleet/shared/i18n/{bg,en}.json` + `messages.ts`    | Scaffolding  | Navigation labels, every Fleet enum label (vehicle type, fuel type, status, device model, option name + short code, driver status, licence category, group colour, data source, activity, fuel status, event kind + kind group, severity, alert status, measurement unit, service type/status/urgency, document type/status, attention reason), data-clock and stale texts, shared field labels (plate, fleet number, VIN, IMEI, driver, vehicle) |
| `features/fleet/<feature>/i18n/{bg,en}.json` + `messages.ts` | Screen agent | Page/drawer titles, descriptions, column headers, filter labels, hints, `serverFieldErrors` per path, notices, confirmations, empty states of that feature                                                                                                                                                                                                                                                                                        |

Each `messages.ts` follows the existing pattern:

```ts
import bg from './bg.json';
import en from './en.json';
import type { Language } from '../../../../i18n/messages';
export const vehicleMessages: Record<Language, typeof en> = { bg, en };
```

Enum labels are nested objects keyed by the GraphQL value (`"vehicleStatus": { "ACTIVE": "Активно",
… }`); `fleet-enums.ts` arrays plus a parity spec prove every enum value has a label in both
languages. Interpolation keeps the `{name}` convention with one helper `interpolate(text, values)`
in `app/ui/i18n` (replaces the scattered `.replace('{x}', …)` in new code).

### 6.2 How components get the language

- Fleet pages, tabs and drawers use `injectFleetScope().language` (captured, constant for the
  component's life) and read `featureMessages[language]` once.
- `app/ui` components and pipes use `inject(UI_LANGUAGE)()`; `AdminWorkspace` provides its
  `language` signal; Storybook provides a fixed English `UI_LANGUAGE` (no `locale` global).
- Karma keeps its `language` inputs and the app catalog unchanged.
- PrimeNG texts (aria labels, paginator, date picker, multiselect) are set centrally by
  `AdminWorkspace` (2.5). Server messages are English; drawers show catalog texts for known field
  paths (3.5).

### 6.3 Parity guard

`app/i18n/catalog-parity.ts` (DS) exports `expectCatalogParity(bg, en)`: identical key trees,
non-empty strings, identical `{placeholder}` sets per key. Every catalog has a `messages.spec.ts`
calling it (feature agents add their own spec beside their catalog).

## 7. Storybook

Superseded: [Storybook review](../admin-design-system.md#storybook-review) and
[Storybook visual review](../testing.md#storybook-visual-review) are authoritative. Storybook is
English only (globals: theme, brand, density). Example pages are story-only hosts with sample data
(`src/storybook/samples`, titles `Examples/…`); GraphQL fixtures cover only `AdminBranches`.
`src/storybook/fleet/*`, the `Screens/Fleet/*` stories and the Login story do not exist. Whether
the Apollo-backed containers get GraphQL fixtures or the stories keep the samples is a user
decision for the admin phase.

### 7.1 Infrastructure changes

| File                                        | Owner (phase)             | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.storybook/preview.ts`                     | DS (F1)                   | Globals `theme`, `locale`, `brand`, `density`; viewports `desktop1440` 1440×900, `tablet768` 768×1024, `mobile375` 375×812; `a11y: { test: 'error', context: { exclude: ['#p-license-host'] } }` once F1 passes; `beforeEach` → `prepareStory(parameters.holita, globals)`                                                                                                                                                                                                                                       |
| `.storybook/main.ts`                        | DS (F1)                   | Add `@storybook/addon-vitest` (T6); keep telemetry disabled                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `.storybook/vitest.config.mts`              | DS (F1)                   | `storybookAngularVitest` + `storybookTest({ configDir })`, browser mode Chromium via `@vitest/browser-playwright`, one worker; not read by `ng test` (Angular unit-test builder ignores Vitest configs)                                                                                                                                                                                                                                                                                                          |
| `.storybook/tsconfig.json`                  | DS (F1)                   | Add `"exclude": ["../src/**/*.spec.ts"]`: the include `../src/storybook/**/*.ts` would otherwise compile the new fixture specs under `types: []` (no Vitest globals) in `npm run typecheck`; `tsconfig.spec.json` keeps type-checking them                                                                                                                                                                                                                                                                       |
| `src/storybook/story-config.ts`             | DS (F1), scaffolding (F2) | `StoryFixtures` (7.2); `storybookApplicationConfig(choice)` with `provideHolitaTheme`, `FixtureHttpBackend`, `provideLocationMocks`, `UI_LANGUAGE` bound to `locale` and `{ provide: WALL_CLOCK, useValue: () => storyNow() }`, where `storyNow()` returns a module-level instant that `prepareStory` sets from `parameters.holita.now` (default `2026-10-18T07:00:00.000Z`) before every story, so the static `applicationConfig` decorator still gives each story its own clock; F2 adds the Fleet store reset |
| `src/storybook/graphql-fixtures.ts`         | DS (F1)                   | New failure kinds (7.2); failures keyed by operation or by `<Operation>:<id>` (7.2); `FixtureVariables` readers `boolean(name)`, `number(name)` (finite), `integer(name)` (null when absent or not an integer; the existing `int(name, fallback)` stays) and `isExplicitNull(name)` (present and `null`, for update inputs that clear a field); `registeredOperations()` for the coverage spec; `fixtureError(code, message, fieldErrors?)` helpers                                                              |
| `src/storybook/session-fixtures.ts`         | Scaffolding (F2)          | RentalSofia `01000000-0000-4000-8000-000000000001`, Discordia `10000000-0000-4000-8000-000000000001`, Sandbox `10000000-0000-4000-8000-000000000002` (same IDs and names as the seeded app); `AdminTenants`, `AdminBranches`, `AdminDemoLogin` handlers for the Login story                                                                                                                                                                                                                                      |
| `src/storybook/fleet/*`                     | Scaffolding (F2)          | Demo dataset, store and shared handlers (7.3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/storybook/fleet/<feature>-fixtures.ts` | Screen agents (F3)        | Handlers for their feature's operations (stub files created in F2)                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/storybook/fleet-fixtures.ts`           | Scaffolding (F2)          | Deleted (replaced by `fleet/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tools/browser/storybook-visual.*`          | DS (F1), scaffolding (F4) | Fixed time `2026-10-18T07:00:00Z`, viewports 1440/768/375, capture list (7.7)                                                                                                                                                                                                                                                                                                                                                                                                                                    |

New dev dependencies (pinned exactly in `apps/admin/package.json`, lockfile updated with
`npm install`): `@storybook/addon-vitest@10.6.1`, `@vitest/browser@5.0.0`,
`@vitest/browser-playwright@5.0.0` (they must match `storybook@10.6.1` and `vitest@5.0.0`).
Need: play functions and a11y `error` must run as tests, not only in the UI panel. Scripts:
`apps/admin` `"test-storybook": "vitest run --config .storybook/vitest.config.mts"`; root
`"test:storybook:admin": "nx run admin:test-storybook --output-style=static"`; Nx target
`test-storybook` (`nx:run-commands`, `dependsOn: ["graphql-generate"]`, `cache: false`). If T6 fails,
these packages are not added (fallback 7.6) and the same root script name runs the fallback:
`"test:storybook:admin": "npm run build:storybook:admin && playwright test --config tools/browser/storybook-interactions.config.mts"`.

Full regression: DS appends `&& npm run test:storybook:admin` to the root `test:full` script in F1
(after `test:smoke:admin`), so the final `test:full` (F5) runs every story smoke, play function and
a11y check; `.github/workflows/full-regression.yml` needs no change (it runs `test:full` after
`build` and already installs Chromium). `docs/testing.md` documents it. PR CI (`test:affected`)
does not run Storybook; this stays a local/full-regression check.

### 7.2 Story parameters and fixture scenarios

```ts
export interface StoryFixtures {
  readonly signedIn?: boolean; // default true
  readonly fleetEnabled?: boolean; // default true
  readonly dataset?: 'demo' | 'empty' | 'no-telemetry'; // Discordia content; default 'demo'
  readonly now?: string; // WALL_CLOCK; default '2026-10-18T07:00:00.000Z'
  readonly scenario?: FixtureScenario;
}
export type FixtureFailure =
  | 'network'
  | 'graphql'
  | 'pending' // existing
  | 'not-found'
  | 'conflict'
  | 'unavailable'
  | 'bad-input' // GraphQL error with that code (no fieldErrors)
  | 'network-after-first'; // first call answers, later calls fail (retained rows)
export interface FixtureScenario {
  readonly latencyMs?: number;
  /** Keys: an operation name (every call fails) or `<OperationName>:<id>` (only calls whose
   * `id` variable equals <id> fail); the record-specific key wins. */
  readonly failures?: Readonly<Record<string, FixtureFailure>>;
}
```

Record-specific failures express partial bulk results, e.g. Alerts `BulkPartialFailure` uses
`{ 'AdminFleetAcknowledgeAlert:<V44 alert id>': 'conflict' }` so the other acknowledgements
succeed against the store.

Field-error scenarios come from handler validation with real inputs (duplicate VIN, duplicate
employee number, IMEI already used, option not allowed for the model), never from flags. Errors use
the backend codes: `BAD_USER_INPUT` + `fieldErrors`, `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE`.

### 7.3 Fleet fixture data (`src/storybook/fleet/`, F2)

| File                       | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo-dataset.ts`          | Deterministic data restating backend 10.3–10.7 (the frontend cannot import `apps/fleet`): groups G01–G05 (`5000…10NN`), drivers D01–D36 (`4000…10NN`), vehicles V01–V46 (`2000…10NN`, plates `CB 10NN AX` and the text edges of backend 10.3) plus the legacy CA1234AB/CA5678AB, devices D01–D44 (`3000…10NN`), service tasks, the live snapshot of 10.4 (including the latest-sample times of V10/V16/V23) stored as API-shaped derived values (activity, fuel status, urgency, document status, attention list) — the seed rows never run a classifier. Trips/events for the 31 Sofia dates 2026-09-18…2026-10-18 like backend 10.5 (needed by the 14-day chart, the previous-window deltas, the 30-day scorecards and the `30d` preset), generated once per store reset with `mulberry32` streams keyed like the backend (`trips:V07:2026-10-12`), plus every storyline a–m (m: D33 drives V40 on 2026-10-13/14/15); open trips of MOVING/IDLE vehicles carry `inProgress: true`, the V31/V14 historic trips without end `false`; samples generated on demand per vehicle for 48 h. Text edges: V33 2,000-code-point notes, V40 32-code-point plate, V38/V42 shared plate, V39 Cyrillic vs V41 Latin plate, D03 long name, storyline l HTML-like details |
| `derived.ts`               | The single deliberate restatement of backend rules, used only for rows that a story creates or changes (seed rows keep their pinned values): `serviceUrgency(task, odometerKm, businessDate)` → `{ urgency, remainingDays, remainingKm }` (backend 7.4, thresholds 14 d / 1,500 km), `nextService(tasks)` (backend 7 order), `documentStatus(driver, businessDate)` (backend 7.3, 30 d), and `activityAfterDeviceChange(state, deviceCount)` (backend 7.1 subset: no device → `NO_DEVICE` with values kept; devices but no device sample → `NOT_CONNECTED`; otherwise unchanged). A MANUAL odometer reading updates `state.odometerKm/odometerRecordedAt/odometerSource` and re-runs `serviceUrgency` and `nextService` for that vehicle. `derived.spec.ts` proves that applying these functions to the seed rows reproduces the pinned values (urgency counts 6/7/1, documents 2/4), so a drift from the backend rules is caught                                                                                                                                                                                                                                                                                                                           |
| `demo-store.ts`            | Mutable copy per story: `resetFleetStore(dataset)`; `revision` clock for writes (`WALL_CLOCK` time); Branch scoping by the `x-branch-id` header (Sandbox empty, other Branch IDs → empty)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `list-helpers.ts`          | Shared in-memory implementation of the standard list contract for fixtures: tokenised case-insensitive search over given fields, enum/ID/boolean/range filters, sort with nulls last + `id DESC` tie-break, offset/limit, totals; validation errors with paths `offset`, `limit`, `search`, `filter`, `sort` like backend 3.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `aggregates.ts`            | Overview values: counts and sums computed from the store where the formula is a count/sum (alerts, vehicles, distance, service, documents); pinned constants for the rest; `no-telemetry` and `empty` variants (null `asOf`, zero counts, `value: null` metrics)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `shared-fixtures.ts`       | Handlers for `AdminFleetDataClock` and the three option queries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `fixture-coverage.spec.ts` | Imports every fixture module and the generated documents; every operation named `AdminFleet*`, `AdminBranches`, `AdminTenants`, `AdminDemoLogin` has a handler                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `demo-dataset.spec.ts`     | Pinned values from backend 10.4 hold in the fixtures: operational 45, workshop 4, inactive 3, without device 3, reporting 38/42, activity 11/5/19/3/4/3, low fuel 3, open critical 4, documents 2/4, OVERDUE 6, DUE_SOON 7, UNKNOWN_ODOMETER 1, 5 groups with "Нова група" empty, ungrouped 6, D33 30-day scorecard 3 trips with `lowConfidence`, attention exactly 15 vehicles in the backend 10.4 order (V44, V07, V11, V04, V37, V39, CA1234AB, V03, V08, V17, V29, V16, V23, V10, V15) with the listed primary reasons and reasons, and `fleetAttention(limit: 10)` answering items 1–10 with `total: 15`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `<feature>-fixtures.ts`    | One per feature (overview, alerts, trips, vehicles, devices, drivers, vehicle-groups, maintenance); handlers for every operation in that feature's `operations.graphql`, mutations update the store (acknowledge sets `ACKNOWLEDGED` and `acknowledgedAt = now`, complete inserts the next task, …) and recompute the affected derived values only through `derived.ts`; `AdminFleetAlertCounts` applies `search` exactly like `AdminFleetAlerts` (shared `list-helpers.ts` search over the backend 3.6 `fleetEvents` fields)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Stories import the fixture modules they need (side-effect imports); a page story that renders tabs
of other features imports those modules too (read-only use of another agent's file).

### 7.4 Stories (titles → ids `screens-fleet-…--…`)

| Title                          | Stories (state = fixture parameters or route)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design System/Foundations      | Colors (all `--p-app-*` and primary/surface ramps in both schemes, live contrast table), Brand variants (three ramps + 1.3 ratios), Typography, Spacing and density (measurement play), Radii and borders, Status tones, Categorical palette, Breakpoints                                                                                                                                                                                                                                                                                          |
| Design System/Patterns         | PageHeader (list, detail with back link, long title), KpiStrip (default, loading, error, nulls, deltas, links), FilterBar (empty, active chips, search error, mobile collapsed), TablePanel (loading, rows, busy, empty, no-results, error, rows-error, notice, selection with progress), RouteDrawer (loading, ready, saving, dirty with confirm, not-found, error, server field errors, read-only), FormField (hint, error, required, counter), EmptyState (all kinds), Charts (ColumnSeries, StackedBars, Sparkline with gaps), Facts, Timeline |
| Design System/PrimeNG coverage | Every registered preset rendered once in both schemes (1.10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Design System/Shell            | Desktop, Rail, Mobile with navigation open, Fleet disabled, Unknown Branch, Branch discovery loading/error, theme-persistence warning                                                                                                                                                                                                                                                                                                                                                                                                              |
| Screens/Login                  | Default, Loading tenants, Tenant error, Branch selection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Screens/Fleet/Overview         | Default, Loading, EmptyBranch (Sandbox), NoTelemetry, Stale (`now` = 2026-10-21T09:00Z), PartialError (`AdminFleetOverviewKpis: 'network'`), AttentionExpanded                                                                                                                                                                                                                                                                                                                                                                                     |
| Screens/Fleet/Alerts           | Default (open), Acknowledged, All, InboxZero (open alerts resolved in the store), NoResults, LoadError, RetainedRowsError, Drawer (V04 critical DTC), DrawerResolvedLongRemark (V12), DrawerConflict, DrawerNotFound, BulkPartialFailure (play), MobileCards (375), **AcknowledgeFlow** (play)                                                                                                                                                                                                                                                     |
| Screens/Fleet/Trips            | Default (7 d), Today, CustomRange, EmptyPeriod, NoResults, LoadError, Drawer (V02 overnight), DrawerYardMove (V05), DrawerUnscored (van without SF), DrawerInProgress (V09), DrawerLongTrip (V06)                                                                                                                                                                                                                                                                                                                                                  |
| Screens/Fleet/Vehicles         | Default, Loading, EmptyBranch, NoResults, LoadError, Filtered (in workshop), SortedSecondPage, BulkSelection, DeletePartialFailure (play), CreateDrawer, EditDrawer, ServerFieldErrors (play: duplicate VIN), DirtyClose (play), DrawerNotFound, **SearchFilterEditFlow** (play)                                                                                                                                                                                                                                                                   |
| Screens/Fleet/Vehicle detail   | Default (V04), NoDevice (V19), NotConnected (V37), Inactive (V20), TwoDevices (V01), TrailerAsset (V45, 0/0), NotFound, TripsTab, AlertsTab, ServiceTab, OdometerDrawer (V19), OdometerValidation (play, V19), OdometerBlocked (V04)                                                                                                                                                                                                                                                                                                               |
| Screens/Fleet/Drivers          | Default, NoResults, DocumentsExpiring, CreateDrawer, EditDrawer, DuplicateEmployeeNumber (play), DeleteBlocked (play), LongName (D03)                                                                                                                                                                                                                                                                                                                                                                                                              |
| Screens/Fleet/Driver scorecard | Default (D01), Risky (D03), LowConfidence (D33, 3 trips on V40), NoTrips (D29), Inactive (D34), NotFound, TripDrawer, EditDrawer (`profile/edit`)                                                                                                                                                                                                                                                                                                                                                                                                  |
| Screens/Fleet/Maintenance      | Default (planned), Overdue, Completed (costs null vs 0), NewDrawer, EditDrawer, CompleteDrawer, **CompleteWithNextFlow** (play), CompleteValidation (play: future date), CancelConfirm                                                                                                                                                                                                                                                                                                                                                             |
| Screens/Fleet/Devices          | Default, NoResults, CreateDrawer, EditDrawer, OptionNotAllowed (play), DuplicateImei (play), LeadingZeroImei, LegacyNulls                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Screens/Fleet/Vehicle groups   | Default, Empty, CreateDrawer, DuplicateName (play), DeleteBlocked (play)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Screen stories render `StoryApp` at a real route (`routeAt('<branch>/fleet/…')`). Every story works in
light/dark, BG/EN, three brands and two densities through the toolbar.

### 7.5 Required play flows

1. **Vehicles: search → filter → open drawer → validate → save → updated list**
   (`Screens/Fleet/Vehicles/SearchFilterEditFlow`): type "TGX" in search (debounce; matches the MAN
   TGX tractors V05, V10, V15, V20), choose status "В сервиз", assert that only V05 remains and the
   URL params, open the edit drawer of V05 from its row, clear the plate and submit → field error
   focused, enter "CB 0505 TT", change the fleet number to "Т-05А", save → drawer closes, notice
   "Превозното средство е запазено.", the row shows the new plate, focus is back on the row link,
   the filter and page are unchanged.
2. **Alerts: acknowledge** (`Screens/Fleet/Alerts/AcknowledgeFlow`): open the V04 critical alert,
   type a remark, "Потвърди" → drawer closes, notice, the row leaves the "Отворени" segment and the
   counts change (open −1, acknowledged +1); switching to "Потвърдени" shows it with the remark.
3. Also as play: vehicles duplicate-VIN field error, dirty close (Escape → confirm → keep editing →
   discard), alert bulk partial failure, maintenance complete with next task, device option/model
   mismatch, driver delete blocked.

Play functions use `storybook/test` (`expect`, `userEvent`, `within`, `waitFor`) and set
`document.documentElement.dataset.playState` to `passed` at the end (used by the fallback runner).

### 7.6 Execution and accessibility

- `npm run test:storybook:admin` runs every story as a smoke test, every play function and axe with
  `a11y.test: 'error'` (license banner excluded). No story may lower the level; a real violation is
  fixed in the token or component, not suppressed.
- Fallback (T6 fails): `tools/browser/storybook-interactions.spec.mts` with its
  `storybook-interactions.config.mts` (Playwright, static build, `outputDir`
  `../../test-results/storybook-interactions`, one worker) opens each play story and waits for
  `data-play-state="passed"`; it runs through the same `test:storybook:admin` script; a11y remains
  a panel review and is reported as unverified.

### 7.7 Visual capture list (`tools/browser/storybook-visual.spec.mts`)

Capture entries carry their own viewports. Fixed time `2026-10-18T07:00:00Z`, `Europe/Sofia`,
`bg-BG`. Baselines stay local and ignored; candidates are reviewed by a person.

**Visual step semantics in gates.** Per `docs/testing.md`, a missing or changed baseline fails
`test:visual:admin` until a person approves candidates, and a redesign changes every screenshot.
In the F1, F4 and F5 gates the visual step therefore counts as passed when the Storybook build
succeeds and every capture in this list produced a candidate in
`test-results/storybook-visual-candidates/`; failures that are only "A snapshot doesn't exist" or
a screenshot mismatch are expected, listed in the agent's report and handed to the user for review.
Any other failure (build error, story error, timeout, missing candidate) fails the gate. Baselines
are recorded only after the user approves the candidates, with
`npx playwright test --config tools/browser/storybook-visual.config.mts --update-snapshots=all`
from a fresh build (docs/testing.md); agents never record baselines on their own. The approval is
a non-blocking review checkpoint unless the user says otherwise.

| Set                      | Stories                                                                                                                                                                                                                                                                                                                  | Theme / locale / viewports                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Screen defaults          | Overview, Alerts, Trips, Vehicles, Vehicle detail, Drivers, Driver scorecard, Maintenance, Devices, Vehicle groups, Login (11)                                                                                                                                                                                           | light bg 1440/768/375; dark bg 1440/375; light en 1440 |
| Drawers                  | Vehicles CreateDrawer, EditDrawer, ServerFieldErrors; Alerts Drawer; Trips Drawer; Maintenance CompleteDrawer; Devices EditDrawer; Groups CreateDrawer; Vehicle detail OdometerDrawer                                                                                                                                    | light bg 1440/375; dark bg 1440                        |
| States                   | Overview EmptyBranch, NoTelemetry, Stale, PartialError; Alerts InboxZero, RetainedRowsError, MobileCards (375 only); Vehicles Loading, NoResults, LoadError, DeletePartialFailure; Vehicle detail NoDevice, NotConnected, Inactive, NotFound; Trips DrawerUnscored; Scorecard LowConfidence (D33); Maintenance Completed | light bg 1440                                          |
| Design system            | Foundations (all), Patterns TablePanel, RouteDrawer, KpiStrip, FilterBar, EmptyState, Charts; PrimeNG coverage; Shell Desktop/Rail/Mobile                                                                                                                                                                                | light and dark bg 1440 (Shell also 375)                |
| Brand and density matrix | Overview and Vehicles in `ember`, `pine` and `comfortable`                                                                                                                                                                                                                                                               | light bg 1440                                          |

Captures pass `globals=theme:…;locale:…;brand:…;density:…` in the iframe URL.

## 8. Tests

### 8.1 Admin unit specs (`npm run test:admin -- --include=… --skip-nx-cache`)

| Spec                                                                                                                                                                                                                                                                                                                                           | Fate                                                                                                                  | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/auth/demo-session.spec.ts`, `core/config/admin-config.spec.ts`, `core/graphql/graphql-options.spec.ts`                                                                                                                                                                                                                                   | Keep                                                                                                                  | Unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `layout/appearance.spec.ts`                                                                                                                                                                                                                                                                                                                    | Move                                                                                                                  | → `theme/appearance.spec.ts`, unchanged cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| All `features/karma-client/**/*.spec.ts`                                                                                                                                                                                                                                                                                                       | Keep                                                                                                                  | Unchanged; must pass under the new shell (the `src/test-setup.ts` of 1.9 provides `matchMedia` and the `--app-bp-*` properties; `karma-workspace.spec.ts` is the named canary in the F1 gate)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `workspace/admin-workspace.spec.ts`                                                                                                                                                                                                                                                                                                            | Rewrite                                                                                                               | Login gating, shell inputs (navigation groups with/without Fleet, context, title), `UI_LANGUAGE`, PrimeNG translations, logout through guard, landing on Overview                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `features/branches/branch-context.spec.ts`                                                                                                                                                                                                                                                                                                     | Rewrite                                                                                                               | Overview landing, section preservation for every Fleet section, record/drawer/query reset, Karma `requiresBranch: false`, unknown Branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `features/fleet/fleet-workspace.spec.ts`                                                                                                                                                                                                                                                                                                       | Rewrite                                                                                                               | Gating (disabled, unknown Branch, signed out) without requests; drawer URLs under each gate (e.g. disabled `…/vehicles/new` → `…/vehicles/<id>/edit` → `/en`, unknown Branch, signed out) navigate without errors because `leaveDrawer` receives `null`; keyed outlet A → B → A with fresh clients; `?search=` on A causes no A request after switching; language switch recreates; delayed A response ignored; router from `provideAdminRouter()`                                                                                                                                                             |
| `features/fleet/vehicles/{vehicles-api,vehicles-deletion,vehicle-editor,vehicle-list-query}.spec.ts`, `features/fleet/devices/{devices-api,devices-deletion,device-editor,device-list-query}.spec.ts`, `features/fleet/relation-picker.spec.ts`                                                                                                | Delete (F2)                                                                                                           | Replaced by the new specs below; their lifecycle cases move to `scoped-graphql-client.spec.ts` and the deletion cases to `sequential.spec.ts` + page specs                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `theme/contrast.spec.ts`                                                                                                                                                                                                                                                                                                                       | New                                                                                                                   | Every AA assertion of 1.3, 1.5, 1.6 for all brands from Aura primitives (white/primary, primary/surface 0 and 50, dark pairs, muted on 50 and canvas muted on 100, tag 800/100, form border ≥ 3 on 0 and 50, focus ring ≥ 3)                                                                                                                                                                                                                                                                                                                                                                                   |
| `theme/holita-preset.spec.ts`                                                                                                                                                                                                                                                                                                                  | New                                                                                                                   | 3 × 2 presets build; primary steps per brand; density tokens; registered component keys equal 1.10; `extend.app` keys present                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `app/ui/**`: `list-state`, `url-list-state`, `table-view`, `sequential`, `field-errors`, `validators`, `format`, `zoned-time`, `remote-options`, `media`, `page-header`, `kpi-tile`, `filter-bar`, `table-panel`, `route-drawer`, `drawer-route`, `leave-drawer.guard`, `form-field`, `column-series`, `stacked-bars`, `sparkline`, `messages` | New                                                                                                                   | Codecs and normalisation (defaults omitted, invalid values dropped, `integer`/`number` ranges, page clamp, > 5 words not applied, `viewDefaultSorts`, `normalizeFilter`), drawer route data and single-name parameter lookup, `leaveDrawer` with `null`, `media` with the test setup (layout switch via `innerWidth` + `resize`, missing-property error), debounce/cancel, view states, partial failures and stop on retirement, error-code/path mapping, Sofia DST conversions, null vs zero, focus return and discard confirmation, canceled close keeps the drawer, bulk bar, paginator events, a11y tables |
| `layout/admin-shell.spec.ts`, `layout/admin-sidebar.spec.ts`                                                                                                                                                                                                                                                                                   | New                                                                                                                   | Rail persistence (storage failure tolerated), drawer close on navigation and at `lg`, Branch menu disabled without Branches, page-change focus, no business inputs                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `core/routing/param-keyed-reuse-strategy.spec.ts`, `core/graphql/scoped-graphql-client.spec.ts`                                                                                                                                                                                                                                                | New (F2)                                                                                                              | Flagged routes recreate on own-param change only; client lifecycle: one initialize, retired reads, pending writes settle then stop, eviction only in the owning client                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `features/fleet/fleet.routes.spec.ts`                                                                                                                                                                                                                                                                                                          | New (F2)                                                                                                              | With `provideAdminRouter()` and `RouterTestingHarness`: every URL in 4.1 resolves to the expected component chain (including `drivers/<id>/edit` → list + drawer, `drivers/<id>/profile/edit` → scorecard + drawer, `vehicles/<id>/overview/edit`, and the three ServiceTaskEditorDrawer URLs); every row of 4.1.1 has its `mode`/`recordParam`/`fixedVehicleParam`; guards and flags present; the flagged-route list matches 12                                                                                                                                                                               |
| `features/fleet/fleet-navigation.spec.ts`                                                                                                                                                                                                                                                                                                      | New (F2)                                                                                                              | `fleetSectionPath` for every section; the 2.3 name collision rule (no Fleet label equals a Karma navigation label or a listed Karma in-page link name, both languages)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `features/fleet/shared/*.spec.ts` (`fleet-enums`, `fleet-time`, `fleet-format`, `fleet-tones`, `data-clock`, `messages`)                                                                                                                                                                                                                       | New (F2)                                                                                                              | Enum completeness, period ranges across DST, stale rule, map link validity, `scoreTone` at 84.9/85/69.9/70/null, catalog parity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Per feature (`overview`, `alerts`, `trips`, `vehicles`, `devices`, `drivers`, `vehicle-groups`, `maintenance`): `<feature>-api.spec.ts`, `<feature>-list.spec.ts` (definition + variables), `<page>.spec.ts`, `<drawer>.spec.ts`, `i18n/messages.spec.ts`                                                                                      | New (F3)                                                                                                              | API uses its own client and documents; variables match the backend contract; page states and bulk flows with `HttpTestingController`; drawer validation, server `fieldErrors` focus, CONFLICT/NOT_FOUND handling, dirty guard, host notification only while alive; alert transition matrix (OPEN/ACK/RESOLVED × three actions, remark omitted/cleared); complete-with-next; device option matrix; scorecard window math                                                                                                                                                                                        |
| `src/storybook/fleet/{fixture-coverage,demo-dataset,derived}.spec.ts`, `src/storybook/graphql-fixtures.spec.ts`                                                                                                                                                                                                                                | `graphql-fixtures.spec.ts` exists; the `src/storybook/fleet/*.spec.ts` files are new in F2 only with GraphQL fixtures | 7.3; variable readers (`boolean`, `number`, `integer`, `isExplicitNull`) and record-keyed failures winning over operation-keyed ones; compiled by `tsconfig.spec.json` only (`.storybook/tsconfig.json` excludes specs, 7.1)                                                                                                                                                                                                                                                                                                                                                                                   |

### 8.2 Browser smoke specs (`npm run test:smoke:admin -- <files>`)

| Spec                                                                           | Fate (owner)               | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `angular-shell.smoke.spec.mts`                                                 | Update for the menu topbar | Geometry read from tokens (computed `--p-app-*` → px): html 16 px; topbar = `topbar.height`; sidebar = `sidebar.width`, rail = `railWidth`; frame gap and radius at 1440; content ≤ `content.maxWidth` and centred at 2560; drawer navigation below 1024 and aside from 1024 (CSS and TypeScript agree at 1023/1024); one-row topbar with the Branch, language and account menus (the application passes no notifications, so the bell exists only in Storybook) at 320/390/768/1023/1024 with a preserved drawer draft; no horizontal overflow at 320/375/768/1024/1440; tab order as in the [smoke rewrite](admin-design-system.md#smoke-rewrite-for-the-menu-topbar): skip link → menu → topbar logo (below 1024 only) → Branch → language → account → sidebar logo → first nav link (from 1024; below it the links are in the closed navigation drawer), with theme and Sign out in the account menu; visible focus in both themes; rail tooltips; mobile drawer focus trap, Escape, backdrop, close on navigation and resize, width = sidebar width at 320; persisted theme and language switch preserving path/query/hash |
| `angular-foundation.smoke.spec.mts`                                            | Rewrite (scaffolding, F2)  | `/en` lands on `/en/<A>/fleet/overview`; navigation groups; A → B → A on Vehicles with exact `x-branch-id` sequence for `AdminFleetVehicles`; delayed A response cannot replace B; language change starts a new request; section preserved on Branch switch, query dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `angular-tenants.smoke.spec.mts`                                               | Update (scaffolding, F2)   | Login lands on Overview ("Overview"/"Преглед" heading); navigation locators by role instead of `.layout-menuitem-root-text`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `angular-vehicles.smoke.spec.mts`                                              | Rewrite (G1)               | Create in drawer (validation focus), edit (notes cleared), list notice and URL kept, reload, deactivate, delete blocked by a device → CONFLICT message → deactivate instead, A → B → A with a drawer open; dirty drawer + Branch switch → confirm → keep editing keeps Branch A; BG desktop/narrow light/dark captures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `angular-devices.smoke.spec.mts`                                               | Rewrite (G5)               | Create with the vehicle autocomplete, duplicate IMEI field error, reassign, leading zeros, delete; BG captures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `angular-drivers.smoke.spec.mts`                                               | New (G2)                   | Create driver, duplicate employee number through Router → field error, assign to a vehicle in the vehicle drawer, delete blocked → set inactive; group create/duplicate/delete blocked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `angular-alerts.smoke.spec.mts`                                                | New (G3)                   | Insert one device sample, one trip and one OPEN alert with `fleetSql` (backend `fleetDatabaseUrl`/`fleetSchema`); acknowledge in the drawer; acknowledge again via API → CONFLICT path in the UI; trips list and drawer timeline show the inserted rows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `angular-maintenance.smoke.spec.mts`                                           | New (G4)                   | Create a task (requireOneOf), complete with next, cancel, delete rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `angular-overview.smoke.spec.mts`                                              | New (G5)                   | Discordia without telemetry (`asOf` null states), Sandbox onboarding, inserted rows show counts, one intercepted card operation fails while the others render and its Retry recovers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Karma smokes (`angular-karma*.smoke.spec.mts`, `angular-edata.smoke.spec.mts`) | Update                     | Theme and language through the topbar menus (see the smoke rewrite in [admin-design-system.md](admin-design-system.md#smoke-rewrite-for-the-menu-topbar)); the 2.3 name collision rule keeps their unscoped link locators unique (e.g. phase3 `getByRole('link', { name: 'Trips', exact: true })`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

`angular-fixture.mts` (scaffolding, F2) adds `app.fleetSql(text, values)` using `pg` with the
backend fixture's `fleetDatabaseUrl` and `fleetSchema` (schema-qualified inserts; no other database).

### 8.3 Commands

```bash
npm run codegen && npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:admin -- --include=app/theme/contrast.spec.ts --include=app/theme/holita-preset.spec.ts --skip-nx-cache
npm run test:admin -- --include="app/ui/**/*.spec.ts" --include="app/layout/**/*.spec.ts" --skip-nx-cache
npm run test:admin -- --include=app/workspace/admin-workspace.spec.ts --include=app/features/branches/branch-context.spec.ts --skip-nx-cache
npm run test:admin -- --include="app/features/fleet/**/*.spec.ts" --include="storybook/**/*.spec.ts" --skip-nx-cache
npm run test:admin -- --include="app/features/karma-client/**/*.spec.ts" --skip-nx-cache
npm run build:storybook:admin
npm run test:storybook:admin
npm run test:visual:admin                      # candidates for human review; gate semantics in 7.7
npm run test:smoke:admin -- angular-shell.smoke.spec.mts angular-foundation.smoke.spec.mts angular-tenants.smoke.spec.mts
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts angular-devices.smoke.spec.mts angular-drivers.smoke.spec.mts
npm run test:smoke:admin -- angular-alerts.smoke.spec.mts angular-maintenance.smoke.spec.mts angular-overview.smoke.spec.mts
npm run test:smoke:admin -- angular-karma.smoke.spec.mts angular-karma-phase2.smoke.spec.mts angular-karma-phase3.smoke.spec.mts angular-karma-phase4.smoke.spec.mts angular-edata.smoke.spec.mts
npm run test:karma-client -- --skip-nx-cache
npm run lint && npm run typecheck && npm run build && npm run format:check
```

`VITEST_MAX_WORKERS=1` on constrained hosts. Never accept zero executed tests; report counts.
`test:full` (which includes `test:storybook:admin` from F1 on, 7.1) only in F5 on the user's
request. Every command in this block runs under the shared-worktree check lock (11).

## 9. Retirement

### 9.1 Files deleted

| Path                                                                                                                                                                                                                                          | Phase / owner                                               | Replaced by                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `apps/admin/src/app/features/fleet/relation-picker.{ts,html,scss,spec.ts}`                                                                                                                                                                    | F2 / scaffolding                                            | `p-autocomplete` + `RemoteOptions`             |
| `apps/admin/src/app/features/fleet/fleet-list.scss`, `fleet-editor.scss`                                                                                                                                                                      | F2 / scaffolding                                            | `app/ui` patterns                              |
| `apps/admin/src/app/features/fleet/vehicles/{vehicles-page.ts,html,scss, vehicle-editor.ts,html, vehicle-list-query.ts, vehicle-validation.ts}` and their specs (`vehicles-api`, `vehicles-deletion`, `vehicle-editor`, `vehicle-list-query`) | F2 / scaffolding                                            | New vehicles feature (G1), stubs created in F2 |
| `apps/admin/src/app/features/fleet/devices/{devices-page.ts,html, device-editor.ts,html, device-list-query.ts, device-validation.ts}` and their specs (`devices-api`, `devices-deletion`, `device-editor`, `device-list-query`)               | F2 / scaffolding                                            | New devices feature (G5)                       |
| `apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts`, `devices/devices-api.ts`, both `operations.graphql`                                                                                                                             | F2 rewritten as stubs, F3 by G1 (vehicles) and G5 (devices) | New APIs and operations                        |
| Fleet keys in `apps/admin/src/app/i18n/{bg,en}.json` that no code references after the deletions                                                                                                                                              | F2 / scaffolding                                            | Feature catalogs                               |

Retirement check (F4): `git grep -n -i "sakai\|layout-topbar\|layout-sidebar\|layout-menu\|fleet-list\|relation-picker\|sakaiPreset"`
outside `.references/`, `.misc/`, `.tmp/` returns only historical notes that 9.3 rewrites (target:
none). `apps/admin` contains no `--surface-*`/`--text-color*` alias use outside
`styles/legacy-karma.scss` and Karma's own CSS.

### 9.2 Behaviour retired

The full-page Fleet editors and their routes' page mode, the RelationPicker dialog, the Sakai
static/overlay layout and its 992 px breakpoint, the 14 px root, the footer, the "Admin" document
title and the Vehicles landing page.

### 9.3 Documentation and rules (F4, scaffolding agent, except where noted)

| Document                                                                                                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/admin-design-system.md` (new, DS agent in F1, completed in F5)                                                                           | Authoritative design-system document: theme module, `appTheme`, brands/densities with AA table, tokens, layers, breakpoints, patterns and their contracts, list URL standard, drawer lifecycle, Storybook review procedure, the central-change procedure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `.agents/skills/holita-admin-design-system/SKILL.md` (new, DS agent)                                                                           | Focused procedure: change a token/brand/density/pattern centrally, add a PrimeNG control (preset + coverage story), add a screen from patterns (list, drawer, detail), required stories/fixtures/checks; links instead of duplicated rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/architecture/decisions/0004-admin-design-system.md` (new, DS in F1; S amends the routing part in F4 only if the implementation deviated) | Problem, why the Sakai-derived shell and per-screen styles cannot give one centrally controlled look, decision (theme module with `appTheme`, brands/densities, CSS layers, `app/ui` patterns, route drawers with keyed outlet + `ParamKeyedReuseStrategy`, per-page/tab/drawer Apollo clients, Storybook with the approved test-tooling dev dependencies), consequences (16 px root, Karma legacy layer); linked wherever 0001–0003 are linked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `AGENTS.md`                                                                                                                                    | Angular admin section points to the design-system document and states that the holita preset and `app/ui` patterns own presentation; the "Documentation" skill list (lines 75–77) adds a link to the admin design-system skill (`.agents/skills/holita-admin-design-system/SKILL.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs/discocan/instructions.md`                                                                                                                | Angular admin bullets: replace Sakai ownership with the design system; drawers for all editing; per-page/per-drawer clients and outlet-data host contract; standard list URL state; Fleet navigation scope (the eight sections) replaces "Fleet navigation contains Vehicles/Devices"; Overview landing; Storybook as the approved review tool; the Devices bullet's "labeled Truck in the editor" becomes "labelled Vehicle (Превозно средство) in the editor" (5.9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs/ecommerce/instructions.md`                                                                                                               | Lines 12–13: the admin is no longer only "the existing Angular Vehicles/Devices workspace"; state that the admin design system (`docs/admin-design-system.md`) is shared by both domains and that Fleet screens, navigation and Vehicle/IMEI rules stay Discocan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `.agents/skills/holita-admin-development/SKILL.md`                                                                                             | Replace Sakai and RelationPicker references; "Truck assignment" → "Vehicle assignment" (lines 41–44); trace the new files (FleetWorkspace, ScopedGraphqlClient, UrlListState, RouteDrawer); Storybook allowed as the review tool; new focused suites                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `.agents/skills/holita-focused-validation/SKILL.md`                                                                                            | Line 34: matching Storybook viewports instead of Sakai; add `test:storybook:admin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `README.md`                                                                                                                                    | Line 5: holita design system on PrimeNG; modules are the Fleet sections plus Karma; "Run locally" text: login opens Overview (not Vehicles), Branch switching preserves the active Fleet section; the Devices paragraph: Vehicle instead of "Truck"; line 72: Storybook review instead of the Sakai reference; link to `docs/admin-design-system.md`. The backend agent adds `db:seed:fleet-demo` in B4 (backend 12)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `docs/README.md`                                                                                                                               | Link the design-system document instead of "Sakai source and Angular agent tools"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `docs/architecture/overview.md`                                                                                                                | Admin row: "Standalone Angular, holita design system on PrimeNG, Branch discovery, Fleet monitoring and management, Karma views"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/development.md`                                                                                                                          | Replace the "Sakai source reference" section with a short "Admin design system" section that links to `docs/admin-design-system.md` (the authoritative description; nothing restated); Storybook section: brand/density globals, `test:storybook:admin`, new dev dependencies; the optional Git-ignored `apps/admin/public/config.local.json` for a PrimeUI key (no value, 1.1); port list without 11002                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `docs/testing.md`                                                                                                                              | Change-to-check rows for theme, patterns, shell, Fleet features; Storybook interaction/a11y run and its inclusion in `test:full`; the unit-test setup file; visual capture sets and the gate semantics of 7.7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `docs/discocan/architecture.md`                                                                                                                | Rewrite "Angular admin foundation": route tree, keyed outlet + reuse strategy, client ownership, drawer lifecycle, shell geometry from tokens, document title, Overview landing; Karma paragraph: "existing PrimeNG theme" instead of Sakai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/discocan/fleet.md`                                                                                                                       | Angular implementation index per feature (pages, drawers, APIs, operations, catalogs); "the holita design system owns presentation"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `docs/discocan/development.md`                                                                                                                 | Lines 4 and 15: shell description; walkthrough from Overview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/discocan/testing.md`                                                                                                                     | New unit/smoke suites; "Sakai focus/theme…" → shell smoke                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/discocan/requirements.md`                                                                                                                | FND-011 (page/tab/drawer client ownership, outlet-data notification), FND-012 (A → B → A including open drawers), FND-013 (Overview landing; section-preserving Branch switch dropping record/drawer/query), FND-014 (route drawers, typed forms, server field focus, retained drafts, dirty close on button/Escape/backdrop/route/unload, focus return), FND-015 (deactivate when history blocks deletion), FND-017 (holita design system, local Lato, BG/EN, persisted light/dark, accessible desktop rail/mobile navigation), FND-018 (one Branch selector across breakpoints; navigation drawer focus/keyboard/close); new rows ADM-001 central theme and brand/density choice, ADM-002 shared patterns, ADM-003 standard list URL state, ADM-004 Overview cards, ADM-005 alert workflow, ADM-006 vehicle detail, ADM-007 trips, ADM-008 drivers/scorecard, ADM-009 maintenance, ADM-010 devices/groups, ADM-011 Storybook review and fixtures |
| `apps/admin/THIRD_PARTY_NOTICES.md` (DS agent, F1)                                                                                             | Remove the Sakai attribution and MIT text (no adapted Sakai code remains); keep Lato (SIL OFL, `public/fonts/lato/OFL.txt`) and the PrimeNG/PrimeUI licence note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/todo/admin-design-system.md`                                                                                                             | S in F4: remove the tasks that are done; keep the open item "rotate the PrimeUI key that remains in Git history" (user action)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`.references/sakai-ng` stays an ignored local checkout; no document refers to it afterwards.

### 9.4 Backlog entries added in F4 (`docs/todo/`)

Remove `styles/legacy-karma.scss` with Karma; mobile card lists for lists other than Alerts if
review asks; Branch time zones and editable thresholds (drawers); map view; saved list views and
export; navigation counts owned by FleetWorkspace with retirement tests (only if requested); system
colour-scheme default; screenshot baselines in CI.

## 10. File ownership map

This map applies only when parallel agents run; a single session owns every file.

Phases are sequential except where marked parallel (∥). Within a phase no two agents edit the same
file. "Read" access is unrestricted. Change requests to a file owned by another agent go through the
orchestrator and are applied by the owner.

### 10.1 Design-system agent (DS)

| Paths                                                                                                                                                                                                                                                                                                                                                                               | When                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/admin/src/app/theme/**`, `apps/admin/src/app/ui/**`, `apps/admin/src/app/layout/**`, `apps/admin/src/styles/**`, `apps/admin/src/styles.scss`, `apps/admin/src/index.html`                                                                                                                                                                                                    | F0–F5 (on call for change requests in F3)                                      |
| `apps/admin/src/app/app.config.ts`                                                                                                                                                                                                                                                                                                                                                  | F1 (theme provider); F2 hands to scaffolding for the reuse strategy, then back |
| `apps/admin/src/app/workspace/**`, `apps/admin/src/app/features/auth/**`                                                                                                                                                                                                                                                                                                            | F1 (then workspace → scaffolding in F2)                                        |
| `apps/admin/src/app/i18n/**`                                                                                                                                                                                                                                                                                                                                                        | F1, F3–F5 (scaffolding in F2 for Fleet-key removal only)                       |
| `apps/admin/.storybook/**`, `apps/admin/src/storybook/{graphql-fixtures.ts,story-config.ts}`                                                                                                                                                                                                                                                                                        | F1 (story-config → scaffolding in F2)                                          |
| `apps/admin/angular.json` (incl. the unit-test `setupFiles`), `apps/admin/src/test-setup.ts`, `apps/admin/tsconfig.spec.json`, `apps/admin/tsconfig.app.json` (exclude the setup file), `apps/admin/package.json`, `apps/admin/project.json`, root `package.json` scripts (incl. `test:full` + `test:storybook:admin`; backend owns only `db:seed:fleet-demo`), `package-lock.json` | F1                                                                             |
| `apps/admin/src/main.ts`, `apps/admin/src/app/core/config/admin-config.{ts,spec.ts}`, `apps/admin/public/config.json`, the `/apps/admin/public/config.local.json` line in root `.gitignore` (PrimeUI key, 1.1)                                                                                                                                                                      | F1                                                                             |
| `apps/admin/src/storybook/graphql-fixtures.spec.ts`, `docs/architecture/decisions/0004-admin-design-system.md`                                                                                                                                                                                                                                                                      | F1                                                                             |
| `docs/todo/admin-design-system.md` ("Remaining phases" rewrite and spec links only)                                                                                                                                                                                                                                                                                                 | F0                                                                             |
| `tools/browser/angular-shell.smoke.spec.mts`, `tools/browser/storybook-visual.{config,spec}.mts`, `tools/browser/storybook-interactions.spec.mts` (fallback only)                                                                                                                                                                                                                   | F1 (visual spec → scaffolding in F4)                                           |
| `docs/admin-design-system.md`, `.agents/skills/holita-admin-design-system/SKILL.md`, `apps/admin/THIRD_PARTY_NOTICES.md`                                                                                                                                                                                                                                                            | F1, F5                                                                         |
| Shell-dependent selectors and imports only in `fleet-workspace.spec.ts`, `vehicle-editor.spec.ts`, `angular-foundation.smoke.spec.mts` and `angular-tenants.smoke.spec.mts` (e.g. `.layout-menuitem-root-text` → role-based group headings)                                                                                                                                         | F1 only (before scaffolding starts)                                            |

### 10.2 Fleet scaffolding agent (S)

| Paths                                                                                                                                                                                                                                                                                                                                              | When                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/admin/src/app/features/fleet/{fleet.routes.ts, fleet.routes.spec.ts, fleet-workspace.*, fleet-navigation.ts, fleet-navigation.spec.ts}`, `features/fleet/shared/**` (incl. `vehicle-detail-context.ts`)                                                                                                                                      | F2, on call in F3, F4                                                                       |
| `apps/admin/src/app/core/routing/**` (incl. `provide-admin-router.ts`), `apps/admin/src/app/core/graphql/scoped-graphql-client.*`, `apps/admin/src/app/app.config.ts` (the `provideAdminRouter()` line), `apps/admin/src/app/app.routes.ts`                                                                                                        | F2, on call in F3                                                                           |
| `apps/admin/src/app/workspace/**`, `apps/admin/src/app/features/branches/**`                                                                                                                                                                                                                                                                       | F2, on call in F3, F4                                                                       |
| Deletion of the retired files in 9.1 (F2 rows) and creation of **stub** files in every feature folder: every routed component of 4.1.2 (exact file and class), `operations.graphql` (one real query of the feature, e.g. `AdminFleetOverviewKpis` for Overview), `i18n/{bg,en}.json` + `messages.ts`, `<feature>-api.ts` (class with `initialize`) | F2 (ownership of each stub passes to its screen agent at F3 start)                          |
| `apps/admin/src/storybook/session-fixtures.ts`, `src/storybook/story-config.ts`, `src/storybook/fleet/{demo-dataset,demo-store,list-helpers,aggregates,derived,shared-fixtures,fixture-coverage.spec,demo-dataset.spec,derived.spec}.ts` and stub `src/storybook/fleet/<feature>-fixtures.ts` (only with GraphQL fixtures)                         | F2, on call in F3, F4 (dataset re-sync only with GraphQL fixtures, 11 F4)                   |
| `tools/graphql/contracts.mts` (`operationPaths` only) and `tools/graphql/contracts.unit.spec.mts` (operation list and count only)                                                                                                                                                                                                                  | F2, after the backend B3 gate (10.4); backend owns `subgraphs` and the inventory assertions |
| `tools/browser/angular-fixture.mts`, `angular-foundation.smoke.spec.mts`, `angular-tenants.smoke.spec.mts`                                                                                                                                                                                                                                         | F2                                                                                          |
| `tools/browser/storybook-visual.spec.mts` (capture list), all documents in 9.3 except the DS-owned ones, `docs/todo/**` entries                                                                                                                                                                                                                    | F4                                                                                          |

Operation files registered by S in `operationPaths` (F2, all at once): `features/fleet/shared`,
`overview`, `alerts`, `trips`, `vehicles`, `devices`, `drivers`, `vehicle-groups`, `maintenance`
(`/operations.graphql` each).

### 10.3 Screen agents (F3, parallel)

| Agent                 | Owns (only)                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 Vehicles           | `features/fleet/vehicles/**` (list, editor drawer, detail page, overview tab, odometer drawer, API, operations, i18n, stories, specs), `src/storybook/fleet/vehicles-fixtures.ts` (only with GraphQL fixtures), `tools/browser/angular-vehicles.smoke.spec.mts`      |
| G2 Drivers & Groups   | `features/fleet/drivers/**` (list, editor, scorecard), `features/fleet/vehicle-groups/**`, `src/storybook/fleet/{drivers,vehicle-groups}-fixtures.ts` (only with GraphQL fixtures), `tools/browser/angular-drivers.smoke.spec.mts`                                   |
| G3 Alerts & Trips     | `features/fleet/alerts/**` (page, drawer, `VehicleAlertsTab`), `features/fleet/trips/**` (page, drawer, `VehicleTripsTab`), `src/storybook/fleet/{alerts,trips}-fixtures.ts` (only with GraphQL fixtures), `tools/browser/angular-alerts.smoke.spec.mts`             |
| G4 Maintenance        | `features/fleet/maintenance/**` (page, editor, complete drawer, `VehicleServiceTab`), `src/storybook/fleet/maintenance-fixtures.ts` (only with GraphQL fixtures), `tools/browser/angular-maintenance.smoke.spec.mts`                                                 |
| G5 Overview & Devices | `features/fleet/overview/**`, `features/fleet/devices/**` (list, editor drawer, API, operations, i18n, stories, specs), `src/storybook/fleet/{overview,devices}-fixtures.ts` (only with GraphQL fixtures), `tools/browser/angular-{overview,devices}.smoke.spec.mts` |

Devices moved from G1 to G5 to balance the groups (G1 keeps the largest feature: list, editor,
detail page, overview tab and odometer drawer).

Cross-feature use is read-only: G1's detail page routes to G3/G4 tab components through
`fleet.routes.ts` (S), and those tabs reach the page only through `VEHICLE_DETAIL` (5.5); G2's
scorecard uses G3's `TripDrawer` through the route; with GraphQL fixtures, G1's vehicle stories
import G3/G4/G5 fixture modules. The vehicle overview tab links to G5's `devices/new?vehicleId=`. A screen agent never
edits `app/ui`, `app/theme`, `layout`, `shared`, routes, another feature folder or another agent's
fixture file; it sends change requests for those to S or DS (both on call in F3) through the
orchestrator.

### 10.4 Shared files and their single writer

| File                                                                                                                                                                             | Writer and time                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/graphql/contracts.mts`, `contracts.unit.spec.mts`                                                                                                                         | Backend agent during B1–B3; S once in F2, only after the B3 gate (F2 starts after the B2 gate, but the `operationPaths` registration and everything that needs generated operation types wait for B3, 11); never concurrently |
| `apps/admin/src/app/app.config.ts`                                                                                                                                               | DS in F1; S in F2                                                                                                                                                                                                             |
| `apps/admin/src/app/i18n/*.json`                                                                                                                                                 | DS; S in F2 (removals only)                                                                                                                                                                                                   |
| `apps/admin/package.json`, `package-lock.json`                                                                                                                                   | DS in F1 only                                                                                                                                                                                                                 |
| Root `package.json`                                                                                                                                                              | DS in F1 (all script changes, incl. `test:full`); backend agent in B4 (only `db:seed:fleet-demo`); never concurrently                                                                                                         |
| `apps/admin/src/app/features/fleet/vehicles/vehicle-list-query.ts`, `devices/device-list-query.ts`                                                                               | Backend agent in B1 (type-only import change, backend 8.4); S deletes them in F2                                                                                                                                              |
| `docs/discocan/*.md`, `docs/testing.md`, `docs/development.md`, `docs/README.md`, `docs/architecture/overview.md`, `README.md`, `.agents/skills/holita-backend-feature/SKILL.md` | Backend agent for backend sections during B-slices; S in F4 after backend B4 (DS only for its own documents in 9.3)                                                                                                           |
| `.agents/skills/holita-admin-development/SKILL.md`, `.agents/skills/holita-focused-validation/SKILL.md`, `AGENTS.md`, `docs/ecommerce/instructions.md`                           | S in F4                                                                                                                                                                                                                       |
| `docs/architecture/decisions/*`                                                                                                                                                  | DS in F1 (0004); backend agent in B1/B4 (0005); S in F4 (0004 amendments only)                                                                                                                                                |
| `docs/todo/admin-design-system.md`                                                                                                                                               | DS in F0 (phase list and links); backend agent in B4 (backend items); S in F4                                                                                                                                                 |

## 11. Implementation order and gates

Each phase ends only when its gate passes completely; failures are fixed before moving on.
Commit only when the workflow or the user asks. Backend slices B3 and B4 follow their own spec.

| Phase | Agents                   | Starts after                                                                         | Runs in parallel with |
| ----- | ------------------------ | ------------------------------------------------------------------------------------ | --------------------- |
| F2    | S                        | Backend B2 gate; operation registration and the F2 gate wait for the backend B3 gate | Backend B3, B4        |
| F3    | G1–G5 (DS and S on call) | F2 gate                                                                              | Backend B4            |
| F4    | S (DS for its documents) | F3 gates of all groups and backend B4                                                | —                     |
| F5    | DS + S                   | F4 gate                                                                              | —                     |

Under "Storybook first", the [open tasks](admin-design-system.md#open-tasks) give the order: the
user's Storybook review and the smoke rewrite for the menu topbar come before the phases (the
parallel column applies only when agents run in parallel). Until that rewrite every signed-in
smoke in the gates below fails. F2 and F3 wire containers, routes and operations to the existing
views and drawers instead of building screens.

**Shared-worktree check lock.** All agents (DS, S, G1–G5 and the backend agent) share one worktree,
one `node_modules`, one Nx cache, one set of `dist` folders, one generated
`apps/admin/src/generated/graphql/operations.ts` and one Playwright output folder per config.
The orchestrator holds a single check lock; an agent runs any command that writes generated or build
output, or starts or stops processes, only while holding it, for one gate or one focused check at a
time: `db:generate`, `codegen`, `schema:check`, `npm run lint` (its `prelint` regenerates),
`typecheck`, `build`, every `test:*` script (including `test:admin`, whose Nx target depends on
`graphql-generate` and rewrites `operations.ts`), `build:storybook:admin`, `test:storybook:admin`,
`test:visual:admin`, `npm run dev` and `npm run kill`. Reasons verified in the code:
`apps/fleet/nest-cli.json` has `deleteOutDir: true`, so a build or `nest start --watch` deletes the
`dist` that a federation or smoke fixture is executing (`node dist/main.js`);
`tools/development/kill.mts` stops every workspace backend and Router process, including other
agents' fixtures; `tools/browser/angular.config.mts` and `storybook-visual.config.mts` write fixed
output folders. Edits, reads, `git` and `format:check` need no lock. A lock holder stops every
process it started (by PID or its own process group, never with `npm run kill`) before releasing
the lock.

### F2 Fleet scaffolding

Scope: route tree with the drawer data of 4.1.1 and a stub for every routed component of 4.1.2,
FleetWorkspace keyed outlet, `ParamKeyedReuseStrategy` and `provideAdminRouter()`,
`ScopedGraphqlClient`, BranchContext/AdminWorkspace landing and section rules, Fleet navigation and
its name-collision spec, shared Fleet folder (incl. `VEHICLE_DETAIL`) and operations, retirement of
the old Fleet files (9.1), stubs and catalogs per feature, `operationPaths` registration,
foundation/tenants smoke rewrites, `fleetSql` fixture helper and, only with GraphQL fixtures, the
Storybook session/dataset/store/derived/shared fixtures and their coverage specs (7.3).

The [central-change checks](../admin-design-system.md#changing-the-design-centrally) of the
design system replace the former F1 gate and pass before F2 starts. Order: S starts after them and
the backend B2 gate with everything that does not need generated operation types (routing, reuse strategy, `provideAdminRouter`, `ScopedGraphqlClient`,
FleetWorkspace, BranchContext, navigation, shared helpers, retirement and, with GraphQL fixtures,
the fixture list helpers and store).
After the backend B3 gate S registers `operationPaths` (10.4), runs codegen and completes the
operation-dependent parts (feature APIs and stubs that use operations; with GraphQL fixtures also
fixture handlers and dataset specs); the F2 gate runs after that.

```bash
npm run codegen && npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:admin -- --include=app/features/fleet/fleet.routes.spec.ts --include=app/features/fleet/fleet-workspace.spec.ts --include=app/features/fleet/fleet-navigation.spec.ts --include="app/features/fleet/shared/**/*.spec.ts" --include=app/features/branches/branch-context.spec.ts --include=app/workspace/admin-workspace.spec.ts --include="app/core/**/*.spec.ts" --include="storybook/**/*.spec.ts" --skip-nx-cache
npm run test:admin -- --include="app/features/karma-client/**/*.spec.ts" --skip-nx-cache
npm run build:storybook:admin && npm run test:storybook:admin
npm run test:smoke:admin -- angular-shell.smoke.spec.mts angular-foundation.smoke.spec.mts angular-tenants.smoke.spec.mts angular-karma.smoke.spec.mts angular-karma-phase3.smoke.spec.mts
npm run lint && npm run typecheck && npm run build && npm run format:check
```

The old Vehicles/Devices smokes are expected to fail between F2 and the G1 (vehicles) and G5
(devices) gates (stubs); they are not part of the F2 gate.

### F3 Screens (G1–G5 in parallel)

Each group: Apollo-backed containers that feed the existing views, drawers and tabs, APIs,
operations, Bulgarian catalogs, unit specs and its smoke spec. With GraphQL fixtures it also adds
fixture handlers and container stories with play flows; otherwise the `Examples/…` stories and
sample hosts stay. Gate per group (example G1; other groups substitute their folders and smoke
files):

```bash
npm run codegen && npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:admin -- --include="app/features/fleet/vehicles/**/*.spec.ts" --include="storybook/**/*.spec.ts" --skip-nx-cache
npm run build:storybook:admin && npm run test:storybook:admin
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts
npm run lint && npm run typecheck && npm run build && npm run format:check
```

All agents share one worktree and one build and run checks only under the check lock (above).
Between edits each agent keeps the tree compiling; a red check caused by another agent's
in-progress work is reported to the orchestrator (not fixed by the reporting agent) and the gate is
re-run once that agent is green again. S and DS stay on call during F3 and apply change requests
to `shared`, routes, workspace, `app/ui`, theme and the shared Storybook files. With GraphQL
fixtures the same rule applies to `fixture-coverage.spec.ts`, which fails while another group
still lacks handlers for its new operations.

### F4 Integration

Scope: final visual capture list, documentation and rules (9.3), backlog (9.4), retirement check,
requirements and removal of completed items from `docs/todo/admin-design-system.md`.

Only with GraphQL fixtures, the scope also includes the Storybook dataset re-sync: S compares the
implemented backend demo catalog (`apps/fleet/prisma/demo/catalog.ts` and backend 10.3–10.7 as
finally documented) with `src/storybook/fleet/demo-dataset.ts` — plates, IDs, statuses, storylines,
the 10.4 pinned values and the attention order — and updates the fixtures and `demo-dataset.spec.ts`
where B4 deviated (reading only; the admin never imports `apps/fleet`). With the sample hosts there
is no dataset re-sync: `fleet-samples.ts` is generated story data, not a restatement of the backend
catalog.

```bash
npm run codegen && npm run schema:check
npm run test:schema -- contracts.unit.spec.mts federation-guard.unit.spec.mts
npm run test:admin -- --skip-nx-cache                                                  # whole admin suite
npm run build:storybook:admin && npm run test:storybook:admin && npm run test:visual:admin
npm run test:smoke:admin -- angular-shell.smoke.spec.mts angular-foundation.smoke.spec.mts angular-tenants.smoke.spec.mts angular-vehicles.smoke.spec.mts angular-devices.smoke.spec.mts angular-drivers.smoke.spec.mts angular-alerts.smoke.spec.mts angular-maintenance.smoke.spec.mts angular-overview.smoke.spec.mts
npm run test:smoke:admin -- angular-karma.smoke.spec.mts angular-karma-phase2.smoke.spec.mts angular-karma-phase3.smoke.spec.mts angular-karma-phase4.smoke.spec.mts angular-edata.smoke.spec.mts
npm run test:karma-client -- --skip-nx-cache
npm run lint && npm run typecheck && npm run build && npm run format:check
```

### F5 Proof and regression

1. Central-change proof: on a scratch edit (reverted afterwards unless the user keeps it) change
   `appTheme` to `{ brand: 'ember', density: 'comfortable' }` and `extend.app.radius.panel`; run
   `npm run test:visual:admin` and present before/after candidates of Overview, Vehicles (list +
   drawer) and Maintenance at 1440 and 375 showing the propagation with no other code change.
2. Build the next small module from the DS skill alone (e.g. a read-only "Data sources" settings
   list) only if the user asks.
3. With the user's explicit request: `npm run test:full`; report counts and any failure.
4. Delete this file and `admin-design-system-backend.md` once their behaviour is documented.

## 12. Risks, accepted trade-offs and deferred items

- **Preview tooling:** `@storybook/angular-vite` is a preview framework; `addon-vitest` adds three
  exact-pinned dev packages. It runs under WSL with one file at a time; a whole file sometimes
  fails with "Failed to fetch dynamically imported module" and passes on a rerun.
- **Preset switching** in Storybook depends on T2; if neither path re-emits component styles
  cleanly, the toolbar reloads the iframe (documented limitation, app unaffected).
- **`light-dark()` and `color-mix()`** need current Chromium/Firefox/Safari (2024+); older browsers
  are not supported by the admin.
- **16 px root** enlarges Karma's rem-based CSS by ~14 %; accepted (Karma is temporary).
- **Route reuse strategy** is global: a route that later needs param-driven reuse must not carry
  `recreateOnParamsChange`; `fleet.routes.spec.ts` lists the flagged routes.
- **Storybook dataset drift** (only with GraphQL fixtures; the examples use
  `samples/fleet-samples.ts`): fixtures restate backend 10.3–10.7 and pin 10.4; drift is caught by
  `demo-dataset.spec.ts` against the documented numbers and by the F4 re-sync against the
  implemented backend catalog, not automatically against the backend generator. `derived.ts` is
  the one deliberate restatement of backend rules (7.3) and `derived.spec.ts` ties it to the
  pinned values.
- **Overview load:** seven card queries plus the data clock per visit; each is bounded by the backend's
  indexes and the 5 s Router budget; no polling.
- **Time zones:** displays and DateTime inputs use Europe/Sofia regardless of the browser zone;
  users elsewhere see Sofia times (labelled in field hints).
- **Search:** literal, tokenised, Latin ≠ Cyrillic look-alikes; stated in the search hint.
- **Business-date drift** of the demo (backend 14) makes Storybook (fixed `now`) and the live demo
  differ after 2026-10-18; Storybook is the stable reference.
- **Parallel F3** depends on the stubs (and, with GraphQL fixtures, the fixture modules) created
  in F2; a missing shared piece becomes a change request to S or DS (both on call), never a local
  copy.
- **Check lock** (11) serialises every build, generation, test and server command across the seven
  agents; it removes races on `dist`, generated types and fixtures at the cost of wall-clock time.
- **PrimeUI key**: the tracked `config.json` no longer holds it (1.1), but the old value stays in
  Git history until the user rotates it. Production license configuration remains
  [open](admin-design-system.md#open-items); the current test release accepts the license notice.
- **Visual approval** is a non-blocking user review (7.7); unapproved candidates do not stop a phase.
  If the user wants approval to block F4, the orchestrator pauses F4 until the user approves.
- **`test:full` duration** grows by the Storybook run (7.1); the full-regression workflow's
  40-minute timeout may need raising if the run approaches it (measured in F5).
- Deferred (backlog, not built): see 9.4 and backend 14.

## 13. Review notes

- Second review round (2026-10-18): every finding was verified against the code before it was
  applied (driver scorecard route, unit-test setup for `media.ts`, `.storybook/tsconfig.json`
  spec exclusion, Karma "Trips" collision, attention list of 15, check lock, drawer route data,
  `leaveDrawer` null case, routed-component stubs, `fleetAlertCounts(search)`, fixture readers and
  per-record failures and per-story clock, `derived.ts`, visual gate semantics, `test:full`, S on
  call, list codecs and per-view sorts, group/driver filter exclusivity, `VEHICLE_DETAIL`,
  `nextService` exception, `inProgress` and score bands, breakpoint module split, PrimeUI key,
  ownership gaps, ADR 0004/0005, `provideAdminRouter`, D33 low confidence, Devices moved to G5).
- Partially applied, F2 timing: F2 now starts after the backend B2 gate, but the `operationPaths`
  registration, operation-dependent code and the F2 gate still wait for the B3 gate, because
  `tools/graphql/contracts.mts`/`contracts.unit.spec.mts` have a single writer and the backend
  edits them in B3; registering earlier would put two agents on the same files.
- Partially applied, concurrent unit specs: the review suggested letting focused unit specs run
  outside the lock; they stay under it because the admin Nx `test` target depends on
  `graphql-generate`, which rewrites the shared `operations.ts`.
