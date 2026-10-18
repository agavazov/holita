# Admin design system

The holita admin (`apps/admin`) has one centrally controlled design system shared by both domains.
It is built on PrimeNG 22 styled mode with `@primeuix/themes` 3 tokens and `@primeicons/angular`.
This document describes the implemented system; the decision record is
[ADR 0004](architecture/decisions/0004-admin-design-system.md) and the focused procedure for
contributors is the [admin design-system skill](../.agents/skills/holita-admin-design-system/SKILL.md).

## Where presentation lives

| Place                         | Content                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/app/theme/`              | `appTheme`, brands, densities, status tones, the preset, the PrimeNG provider, contrast checks, light/dark `Appearance`  |
| `src/styles/` + `styles.scss` | Global CSS layers: reset, base, shell, patterns and the Karma legacy layer; breakpoints; the Lato faces                  |
| `src/app/ui/`                 | Domain-neutral components, CSS-pattern consumers and helpers (patterns below), their BG/EN catalog and Storybook stories |
| `src/app/layout/`             | The shell: `AdminShell`, `AdminSidebar`, `AdminTopbar` and the `NavGroup`/`NavItem` navigation model                     |
| `src/app/workspace/`          | Composition: the navigation groups, the topbar page context, the document title, `UI_LANGUAGE` and PrimeNG texts         |

Nothing else defines colours, radii, shadows, spacing scales or breakpoints. Component styles use
only `var(--p-*)` tokens (including `--p-app-*`), the global pattern classes and the breakpoint
mixins. Global and component SCSS contain no `.app-dark` selectors and no literal colours.

## Theme

`holitaPreset(choice)` (`theme/holita-preset.ts`) is `definePreset` over standard Aura
(`@primeuix/themes/aura/base` plus the registered component presets) with:

- `semantic`: the brand's primary ramp and steps, one neutral `surface` ramp for both schemes,
  focus ring (2 px solid primary, offset 2 px), content border, form-field paddings and borders,
  list option padding and a 0.15 s transition;
- `components`: density paddings and font sizes for buttons, DataTable and Drawer; status tones for
  Tag, Message, Badge and Button (solid, outlined and text); unselected toggle/segment labels;
  tooltip colours;
- `extend.app`: the holita tokens, emitted as `--p-app-*`;
- `css`: central rules tokens cannot express: uppercase 11–12 px column titles for every
  DataTable header cell, `tabular-nums` for `.app-num`, the density row height, the tab-bar gap and
  single-sided `p-timeline` events.

`provideHolitaTheme(choice, license?)` returns `providePrimeNG({ ripple: false, theme, license })`
with `darkModeSelector: '.app-dark'` and `cssLayer: { name: 'primeng', order: 'holita-reset,
primeng, holita' }`. `app.config.ts` passes `appTheme` and the optional PrimeUI license from the
runtime configuration. The tracked `public/config.json` holds no license; a developer with a key
puts `{ "primeUiLicense": "…" }` into the Git-ignored `apps/admin/public/config.local.json`, which
`main.ts` merges over `config.json` (a 404 or a non-JSON fallback page means none; any other
failure or unknown key is a configuration error). Without a license PrimeNG shows its "Invalid
PrimeUI License" notice, as in Storybook.

### The configured choice

```ts
// theme/theme-choice.ts
export const appTheme: ThemeChoice = { brand: 'cobalt', density: 'compact' };
```

`appTheme` is the only place the application chooses its look. Storybook switches brand and
density per story through toolbar globals; the application never reads them.

### Brands

A brand names an Aura primitive palette for `primary`, one neutral palette for `surface` and the
primary steps used in light and dark (`theme/brands.ts`). Ramps reference primitives
(`{blue.600}`), never hex copies.

| Brand              | Primary | Neutral | Light primary / hover / active | Dark primary / hover / active | Selected-row and accent-tag text |
| ------------------ | ------- | ------- | ------------------------------ | ----------------------------- | -------------------------------- |
| `cobalt` (default) | blue    | slate   | 600 / 700 / 800                | 400 / 300 / 200               | 700                              |
| `ember`            | orange  | zinc    | 700 / 800 / 900                | 400 / 300 / 200               | 800                              |
| `pine`             | teal    | stone   | 700 / 800 / 900                | 400 / 300 / 200               | 800                              |

`cobalt` is the default because an orange primary sits next to amber `warn` and red `danger`
statuses. Contrast (WCAG 2.x) computed from the Aura primitives:

| Brand    | White on primary / hover | Primary on surface 0 / 50 / 100 | Dark: primary on 900 / 950 | Dark: 950 on primary / hover |
| -------- | ------------------------ | ------------------------------- | -------------------------- | ---------------------------- |
| `cobalt` | 5.17 / 6.70              | 5.17 / 4.94 / 4.72              | 7.02 / 7.93                | 7.93 / 11.19                 |
| `ember`  | 5.18 / 7.31              | 5.18 / 4.96 / 4.71              | 7.83 / 8.79                | 8.79 / 11.80                 |
| `pine`   | 5.47 / 7.58              | 5.47 / 5.24 / 5.02              | 9.39 / 10.61               | 10.61 / 13.35                |

`theme/contrast.spec.ts` asserts every pair the admin relies on for all brands: primary and
hover text, primary on surfaces, selected and accent text, focus ring, text and muted text,
canvas muted text, form-field borders (≥ 3:1), status tags, messages, solid and outlined/text
buttons, segment labels, status marks and the categorical palette. The "Foundations/Colors" and
"Foundations/Brand variants" stories show the same checks live.

### Densities

| Token                                                            | `compact` (default)               | `comfortable`                 |
| ---------------------------------------------------------------- | --------------------------------- | ----------------------------- |
| Form field padding Y / X                                         | 0.375rem / 0.625rem               | 0.5rem / 0.75rem              |
| List option padding                                              | 0.375rem 0.625rem                 | 0.5rem 0.75rem                |
| Button padding Y / X                                             | 0.375rem / 0.75rem                | 0.5rem / 0.875rem             |
| DataTable header cell / body cell padding                        | 0.5rem 0.75rem / 0.375rem 0.75rem | 0.625rem 1rem / 0.625rem 1rem |
| Table body text / column title                                   | 13 px / 11 px                     | 14 px / 12 px                 |
| Drawer content padding                                           | 0 1.25rem 1.25rem                 | 0 1.5rem 1.5rem               |
| `--p-app-row-height` / `--p-app-control-height`                  | 48 px / 34 px                     | 56 px / 40 px                 |
| `--p-app-topbar-height`                                          | 52 px                             | 56 px                         |
| `--p-app-gutter` / `--p-app-panel-padding` / `--p-app-stack-gap` | 1.25 / 1 / 1rem                   | 1.5 / 1.25 / 1.25rem          |
| `--p-app-text-title` (page h1)                                   | 1.375rem                          | 1.5rem                        |

The "Foundations/Spacing and density" story measures an input, a button, a select and a table
row and fails when a height differs from the control or row token by more than 1 px.

### Tokens (`--p-app-*`)

| Group             | Tokens                                                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography        | `font-family` (local Lato, then system UI), `font-numeric`; `text-xs` 11 px (eyebrows, labels, column titles), `text-sm` 12 px, `text-table`, `text-base` 14 px, `text-md`, `text-lg`, `text-title`, `text-kpi` |
| Space and shape   | `space-1…10` (0.25–2.5rem), `radius-frame` 12 px, `radius-panel` 8 px, `radius-control` 6 px, `radius-tag` 4 px, `shadow-floating` (bulk bar and route drawers only)                                            |
| Surfaces          | `canvas-background`, `canvas-muted-color`, `frame-background`, `frame-border-color`, `panel-*` (background, border, header background, padding, radius)                                                         |
| Shell             | `frame-gap`, `frame-radius`, `sidebar-width` 15.5rem, `sidebar-rail-width` 4rem, `sidebar-item-*`, `topbar-height`, `content-max-width` 100rem, `gutter`, `gutter-narrow`                                       |
| Layout            | `stack-gap`, `control-height`, `row-height`, `drawer-width-md` 35rem, `drawer-width-lg` 45rem, `kpi-min-width`                                                                                                  |
| Status and series | `tone-<success                                                                                                                                                                                                  | info | warn | danger | neutral | accent>-<color | background | solid>`, `category-c1…c8` |

The muted text colour fails AA on surface 100, so the canvas uses `canvas-muted-color` (600 in
light) and table and panel headers use surface 50.

### Status tones and categories

`theme/status-tones.ts` declares the families once: success → green, info → sky, warn → amber,
danger → red, plus `neutral` (surface) and `accent` (primary). Tags use 800 text on a 100 tint in
light and 200 text on a 16 % tint in dark; messages 700 on 50; solid buttons and badges 600/700
with white text (400 with surface-950 text in dark); outlined and text buttons 700 (300 in dark).
`ui/tones.ts` maps a `StatusTone` to a `p-tag` severity; there is no status-tag wrapper. Vehicle
groups and chart series use the eight categorical slots `c1…c8`. Colour is never the only
carrier of meaning: dots sit next to labels and charts carry a visually hidden table.

### Light and dark

`Appearance` toggles `.app-dark` and `color-scheme` on `<html>` and persists
`holita.admin.theme` (`light` by default; a storage failure shows a warning in the shell). Every
value that differs between schemes is a `light-dark()` token, so one class switches PrimeNG and
holita tokens alike.

## Global styles, layers and breakpoints

`styles.scss` loads, in order: `_layers` (`@layer holita-reset, primeng, holita;`), `_fonts`,
`_breakpoint-properties`, `_reset` (box sizing, font and link inheritance), `_base` (document,
headings, focus, skip link, `.app-visually-hidden`, reduced motion), `_shell`, `_patterns` and
`_legacy-karma`. Holita rules override PrimeNG without `!important`; component stylesheets are
unlayered.

`styles/_breakpoints.scss` is the only declaration of the breakpoints (`sm` 640, `md` 768,
`lg` 1024, `xl` 1280, `xxl` 1536 px) with the `below($name)` and `from($name)` mixins; it emits no
CSS, so component stylesheets `@use 'breakpoints'` (resolved through
`stylePreprocessorOptions.includePaths` in the build, test and Storybook targets).
`_breakpoint-properties.scss` emits `--app-bp-*` once; `ui/media.ts` `below(name)` reads them and
returns a `matchMedia` signal, so TypeScript and CSS switch at the same pixel. In unit tests
`src/test-setup.ts` provides the properties and a deterministic `matchMedia` driven by
`window.innerWidth`.

| Width  | Behaviour                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| `< sm` | Branch selector on a second topbar row, filter controls behind a "Filters (n)" toggle, stacked drawer actions |
| `< md` | Full-width drawers, 16 px gutter, secondary table columns (`.app-col-secondary`) hidden                       |
| `< lg` | Sidebar becomes a navigation drawer; the frame becomes full-bleed                                             |
| `≥ md` | Card grids two columns (three from `xl`); form grids two columns from `sm`                                    |

`_legacy-karma.scss` is the only place the pre-design-system classes (`.card`, `.page-heading`,
`.page-actions`, `.content-link`) and Sakai variable aliases (`--surface-border`,
`--text-color-secondary`, …) survive, mapped to the new tokens for Karma Client pages and the
Vehicles/Devices screens that predate the patterns. New code does not use them.

## Shell

`AdminShell` (`holita-admin-shell`) renders the canvas, the sidebar (full width or a 64 px rail on
desktop, a modal `p-drawer` below `lg`), the sticky topbar and the framed `<main id="main-content">`
with the projected page. Inputs: `branches`, `branchId`, `language`, `languageUrl`, `loading`,
`tenantName`, `navigation: readonly NavGroup[]`, `context: { group, page } | null`; outputs
`signOut` and `branchSelected`. It imports no feature code and reads no business data; navigation
has no counts.

- The document scrolls; the sidebar is sticky on the canvas and the topbar sticks inside the frame.
  Page content is centred up to `content-max-width` with the density gutter.
- The rail keeps link names as visually hidden text and shows tooltips; the choice persists in
  `localStorage` `holita.admin.sidebar` (a storage failure only loses the preference).
- One Branch `p-select` exists at every width; CSS grid areas move it to a second row below `sm`.
- The topbar shows the page context (group › page), the Branch selector, a link to the other
  language (labelled with that language's own name, preserving path, query and fragment), the
  theme toggle and sign-out. The logo links to the Branch's Fleet section.
- Accessibility: skip link first, `<header>`, labelled `<aside>` with `<nav>`, group headings,
  `aria-current="page"` on the active item, a modal navigation drawer that takes focus on its
  close button, closes on navigation and at `lg` and returns focus to the menu button. After a page
  change (route chain without drawer and tab routes) the shell focuses `#page-title`, or `<main>`.
- `AdminWorkspace` composes the navigation (`workspace/admin-navigation.ts`), derives the context
  from the longest matching navigation link, sets `document.title` to `<page> · holita`
  (`Вход · holita` / `Sign in · holita` on login), provides `UI_LANGUAGE` and sets PrimeNG texts
  (`workspace/primeng-translation.ts`: date names and `dd.mm.yy`, Monday first, overlay messages
  and aria labels).

## Patterns (`src/app/ui`)

Components exist only where structure, state or behaviour repeats; single PrimeNG controls
(`p-tag`, `p-selectbutton`, `p-select`, `p-autocomplete`, `p-datepicker`, `p-inputnumber`,
`p-toggleswitch`, `p-tabs`, `p-timeline`, `p-metergroup`, `p-avatar`, `p-skeleton`) are used
directly. Every component is standalone, `OnPush`, uses signal inputs and outputs, the `holita-`
prefix and texts from `uiMessages[inject(UI_LANGUAGE)()]`.

| Pattern                                                           | Contract                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `holita-page-header`                                              | `title` (the page's only `<h1 id="page-title" tabindex="-1">`), `eyebrow`, `count`, one-line `description`, `backLink`/`backLabel`; slots `[headerMeta]`, `[headerActions]`; `focusTitle()`                                                                                                                                                                                                                                     |
| `holita-kpi-strip` + `holita-kpi-tile`                            | Strip: `label` (group name), `loading`, `error` + `retry`. Tile: `label`, pre-formatted `value` (`null` → "—"), `unit`, `secondary`, `footnote`, `delta` (trend + sentiment), `tone` marker, `explanation` popover, `link` + `queryParams`, `loading`                                                                                                                                                                           |
| `holita-filter-builder` + `filter-model.ts`                       | Always-visible quick search (`searchLabel`, `search`, `searchError`, `searchChange`) plus "Add filter": `fields` (column, type `text`/`enum`/`number`/`date`/`boolean`, the operators the backend supports, options, unit) build `conditions` (`conditionsChange`); conditions are chips that reopen the editor and all apply together (AND); slot `[filterActions]`                                                            |
| `holita-table-panel` + `tableView()`                              | `heading`, `headingLevel`, `total`, `view` (`loading`, `rows`, `empty`, `no-results`, `error`, `rows-error`), `errorText`, `busy` (2 px refresh bar + `aria-busy`), empty texts and `[emptyActions]`, `notice`, selection count/progress, `page` (1-based). No footer without rows; one page shows only the range; the bulk bar sits below the panel and sticks to the viewport bottom, so selecting never moves rows or footer |
| `holita-row-actions`                                              | The "⋮" menu of a row: `actions` (`id`, `label`, `danger`, `disabled`), `subject` (accessible name "Actions for …"), output `action`; destructive actions come last after a separator. Lists never show a direct Delete button in a row                                                                                                                                                                                         |
| `holita-route-drawer`                                             | `title`, `subtitle`, `[drawerMeta]`, `size` (`md`/`lg`), `state` (`loading`, `ready`, `not-found`, `invalid-id`, `error`), `saving`, `dirty`, `closeLink` (null: closing emits `closeRequest`); body slot and sticky `[drawerFooter]`; `confirmLeave(dirty)`; focus capture and return                                                                                                                                          |
| `holita-form-field`                                               | `label`, `controlId`, `hint`, `error` (`#<id>-error`), `required`, `counter`; the projected control sets `aria-describedby`, `aria-invalid` and `[invalid]`                                                                                                                                                                                                                                                                     |
| `holita-empty-state`                                              | `kind` (`empty`, `no-results`, `error`, `not-found`, `disabled`, `no-telemetry`, `done`), `title`, `description`, `compact`, `[emptyActions]`; errors are `role="alert"`, others `role="status"`                                                                                                                                                                                                                                |
| `holita-column-series`, `holita-stacked-bars`, `holita-sparkline` | CSS/SVG charts with an accessible name and a visually hidden data table (sparkline: `role="img"` with a spoken summary); `null` values are gaps, zero is a hairline                                                                                                                                                                                                                                                             |

CSS patterns (`styles/_patterns.scss`): `.app-view` (a page view's host class: header, KPIs,
filters and panels stacked inside the shell's `.app-page`), `.app-settings-section` (a settings
card with its title and hint beside the fields) and `.app-save-bar` (Discard and Save of a page
form, sticky while there are changes), `.app-card`, `.app-card-grid`, `.app-stack`,
`.app-facts` (definition-list grid), `.app-form-section` and `.app-form-grid`
(`.app-form-grid--wide`), `.app-drawer-actions`, `.app-dot--<tone|slot>`, `.app-num`, `.app-mono`,
`.app-muted`, `.app-cell-stack`, `.app-cell-truncate` (one line with an ellipsis, full text in
`title`), `.app-meter` (`.app-meter--<tone>`), `.app-meter-cell` (meter plus value),
`.app-inline` (a value with its dot or tag on one line), `.app-col-secondary`, `.app-col-check`,
`.app-col-actions`, `.app-timeline-event`, `.app-link` (`button.app-link` is a row's record link
that opens its drawer), `.app-icon-button`, `.app-logo`, `.app-menu-danger`.

Helpers: `list/list-query.ts` (`ListQuery` — search, AND conditions, sort, page — and the
`listQuery` transitions a FilterBuilder list emits; any change except paging returns to page 1),
`list/list-state.ts` and `list/url-list-state.ts` (below), `list/sequential.ts`
(`runSequential` for bulk writes with progress, partial failures and a stop when the page is
retired), `forms/field-errors.ts` (`errorCode`, `fieldErrors` from GraphQL `extensions`),
`forms/validators.ts`, `forms/focus.ts` (`focusFirstInvalid`), `forms/inner-input-pt.ts`
(`innerInputPt` links hint/error and `aria-invalid` on the inner input of `p-inputnumber` and
`p-datepicker`), `remote-options.ts`
(`RemoteOptions` for `p-autocomplete`: debounced latest-wins search and hydration by IDs),
`confirm.ts` (`confirmDestructive`, `confirmDiscard`, `confirmDialogPt`), `format/` (null → "—",
zero stays zero, `bg-BG`/`en-GB`, Europe/Sofia date-times, calendar dates without zone
conversion, relative times against an explicit reference, durations, money from cents and
DST-aware wall-time conversion), `clock.ts` (`WALL_CLOCK`), `ui-language.ts` (`UI_LANGUAGE`),
`media.ts` and `tones.ts`. `ui/i18n/{bg,en}.json` hold the pattern texts; `interpolate(text,
values)` fills `{name}` placeholders.

### Table conventions

Hosts project a `p-table` into `holita-table-panel` with `[lazy]`, `[lazyLoadOnInit]="false"`
(the host loads the first page itself), `[sortField]`/`[sortOrder]` from the `ListQuery` and
`(onLazyLoad)` mapped through `listQuery.sorted` behind `injectSortReady()` (PrimeNG 22 reports
an intermediate ascending sort while applying its inputs on the first render), `dataKey="id"`, horizontal
scrolling inside the panel and no `emptymessage` template (the panel renders every state). A
selection header cell contains a visually hidden `<label for>` and `p-table-header-checkbox
[inputId]` (PrimeNG names the header checkbox only after its value changes); row checkboxes use
`[ariaLabel]`. Secondary columns carry `.app-col-secondary`; numeric columns `.app-num`. Header
and body cells never wrap (a wide table scrolls sideways, and `provideHolitaTheme` makes every
table's scroll container a tab stop so the keyboard can scroll it); long free text (notes, descriptions) is
one line with `.app-cell-truncate` and the full text in `title`. Row actions are a last
`.app-col-actions` column with `holita-row-actions`, frozen to the right (`pFrozenColumn
alignFrozen="right"` on its `th` and `td`) so the menu stays reachable while scrolling.
`p-sort-icon` is the sort indicator element.

### PrimeNG usage rules

Registered component presets (`registeredComponents`): autocomplete, avatar, badge, button,
checkbox, chip, confirmdialog, datatable, datepicker, dialog, drawer, iconfield, inputnumber,
inputtext, listbox (the existing Fleet relation picker), menu, message, metergroup, paginator, popover,
select, selectbutton, skeleton, tabs, tag, textarea, timeline, togglebutton, toggleswitch, tooltip
and virtualscroller. Adding a control means adding its preset there and to the "PrimeNG coverage"
story. Because stories run axe with violations as failures, and lint rejects deprecated APIs:

- every `<p-confirmdialog>` uses `[pt]="confirmDialogPt(language)"` (names its close button and
  makes the `p-dialog` host presentational);
- `p-popover` gets `ariaLabel`, `p-drawer` `ariaCloseLabel`, `p-dialog` `closeAriaLabel`,
  `p-autocomplete [dropdown]` `dropdownAriaLabel`, `p-metergroup` an `aria-label`;
- multiple choice uses `p-select [multiple]="true"` (PrimeNG 22 deprecates `p-multiselect`);
  applied filters are FilterBuilder chips;
- `p-progressbar` is not used (it renders an `aria-level` attribute progress bars may not carry);
  TablePanel draws its own decorative refresh bar;
- `p-autocomplete [forceSelection]` clears unmatched text only when its overlay is closed at the
  input's `change` event; leaving the field while "no results" is shown keeps the typed text and
  the previous value, so a single-value picker reconciles its text with the selected option when
  focus leaves it.

## List URL state

`ListDefinition` declares page sizes (10, 20, 50, 100; default 20), the sort parameters and default
sort (optionally per view), typed filter codecs (`enumList`, `idList`, `boolean`, `dateOnly`,
`choice`, `integer`, `number`) and an optional cross-field `normalizeFilter`. `readListState`,
`listStateParams` (defaults omitted), `sameListState` and `activeFilterCount` are pure.
`UrlListState` keeps the state in the query string:

| Parameter          | Rules                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `search`           | Trimmed, NUL removed, at most 200 code points; more than five words is not applied (FilterBuilder error) |
| `sort`, `order`    | Sort parameter from the definition and `asc`/`desc`; absent means the effective default                  |
| `page`, `pageSize` | 1-based page (clamped; corrected to the last page once totals arrive) and an allowed size                |
| filter fields      | Comma-separated, validated by the codec; unknown values are dropped                                      |

Any change except paging returns to page 1; invalid or non-normalised URLs are rewritten with
`replaceUrl`. Search input is debounced by 300 ms; `p-table` sort events are mapped through the
definition. `UrlListState` never fetches: pages map the state to their own query variables.

## Route drawers

Editing happens in child routes rendered in `holita-route-drawer`. Close button, Escape and the
backdrop navigate to `closeLink` (default `..`) with the query and fragment preserved; the route's
`leaveDrawer` guard calls the host component's `canLeave()`, which calls `confirmLeave(dirty)`;
"keep editing" cancels the navigation and leaves the drawer open, and a dirty drawer also guards
page unload. `leaveDrawer` allows leaving when no drawer component is mounted.
`drawerRouteData(route)` validates the drawer `data` (`mode`, `recordParam`,
`fixedVehicleParam`) and `drawerParam(route, name)` reads a parameter from the route or its
ancestors. Hosts render `<router-outlet [routerOutletData]="drawerHost" />`;
`injectDrawerHost()` reads that `DrawerHost` (a no-op host in isolated stories) so a drawer can
report `saved({ message, recordId })` while it is alive. On destroy the drawer returns focus to the
element that opened it, or `#page-title`.

## Storybook review

The admin Storybook (`npm run storybook:admin`, port 11003) renders the real Angular components
with `FixtureHttpBackend` GraphQL fixtures ([development](development.md#admin-storybook)). It
opens on "Start here" (what to review and links to every example), then Examples and Design
System. It is English only; the product's languages live in the application catalogs, and the
shell's language menu lists sample languages that change nothing. Example pages
(`src/storybook/samples`) are story-only hosts that feed the `features/fleet/*` views and drawers
from deterministic sample data; `?scenario=` and `?drawer=` in a story's URL open its states. Toolbar globals: theme, brand and
density; viewports `desktop1440`, `tablet768`, `mobile375`. A brand or density change re-bootstraps the story with `provideHolitaTheme(choice)`
and leaves no stale theme styles. `parameters.holita` (`StoryFixtures`) controls the session,
Fleet availability, dataset, the story clock (`now`, default `2026-10-18T07:00:00.000Z`) and
fixture failures (per operation or `<Operation>:<id>`).

| Title                          | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Design System/Foundations      | Colors (every `--p-app-*` and ramp in both schemes, live contrast table), Brand variants, Typography, Spacing and density (measured), Radii and borders, Status tones, Categorical palette, Breakpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Design System/Patterns         | PageHeader, KpiStrip, FilterBuilder, TablePanel (with row actions), Drawer (edit, view, view then edit), FormField, EmptyState, Charts, CSS patterns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Design System/PrimeNG coverage | Every registered control in both schemes, non-modal overlays and the confirm dialog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Design System/Shell            | Desktop, Rail, Mobile with navigation open, Fleet disabled, Unknown Branch, Branch discovery loading/error, theme-persistence warning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Examples                       | Example pages inside the shell with sample data (no GraphQL); the sidebar switches between them and Examples/Tour visits all of them. Overview: KPI tiles that open their lists, items that need attention, distance and activity charts, latest trips. Vehicles: quick search, filters, sorting, row and bulk actions, direct edit in the drawer, all states. Drivers: document expiry flags, scores and the mixed drawer (view, then Edit). Trips: a read-only list and a view drawer with a timeline. Alerts: a default filter chip, status-dependent row and bulk actions, and a view drawer with workflow actions (acknowledge, resolve with a remark, reopen). Vehicle profile: a full record page with back link, Edit (the vehicle drawer), KPIs and tabs (overview with facts and a chart, trips, alerts, service plan), loading, not found and error. Maintenance: urgency by date or odometer, money, and a drawer form that needs a date or an odometer reading. Devices: connection, signal and firmware, and a drawer with read-only diagnostics above the installation form. Settings: a short groups list without search or paging (groups in use cannot be deleted) and the General page form with titled cards and a sticky save bar |

`npm run test:storybook:admin` runs every story in Chromium through `@storybook/addon-vitest`:
rendering, play functions and axe with `a11y.test: 'error'` (the PrimeUI license notice
`#p-license-host` is excluded). A violation is fixed in the token, component or story markup,
never by lowering the level. `npm run test:visual:admin` captures the reviewed stories
([testing](testing.md#storybook-visual-review)).

## Changing the design centrally

1. Brand or density for the application: change `appTheme` in `theme/theme-choice.ts`; nothing
   else changes.
2. A token: change it in `theme/` (brand, density, status tone or `appTokens`), add or adjust the
   contrast checks when a colour pair changes, and review Foundations, Patterns and a screen story
   in both schemes.
3. A new brand or density: add it to `brands.ts`/`densities.ts` and the `BrandName`/`DensityName`
   unions; the Storybook toolbar, preset spec and contrast spec pick it up.
4. A pattern: change the component or CSS pattern once; every screen using it follows. Update its
   stories and spec in the same change.

Checks for such a change: `npm run test:admin -- --include="app/theme/**/*.spec.ts"
--include="app/ui/**/*.spec.ts" --include="app/layout/**/*.spec.ts" --skip-nx-cache`,
`npm run test:storybook:admin`, `npm run test:visual:admin` (candidates for review) and the
shell smoke (`npm run test:smoke:admin -- angular-shell.smoke.spec.mts`).
