# Admin design system

The shared presentation rules for `apps/admin`: theme, global styles, shell and reusable
patterns. Use the [design-system skill](../.agents/skills/holita-admin-design-system/SKILL.md)
when changing presentation. Meridian is visual inspiration only; no copied source/assets.
The code defines individual component inputs and implementation details.

## Where presentation lives

Paths below are relative to `apps/admin/src`.

| Area                           | Owns                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `app/theme/`                   | PrimeNG preset, brands, density, tokens, status/category palettes and contrast checks |
| `styles/`                      | Fonts, layers, breakpoints, reset/base, shell and shared CSS patterns                 |
| `app/ui/`                      | Repeated domain-neutral components/helpers, BG/EN texts and stories                   |
| `app/layout/`                  | Business-independent shell, sidebar, topbar, navigation and record breadcrumb         |
| `app/workspace/`               | Session/language composition, page context/title and PrimeNG translations             |
| `app/features/`                | Concrete business views, typed forms, services and generated operations               |
| `storybook/`, `../.storybook/` | Fixtures and review scenarios, excluded from application output                       |

Keep colors, spacing scale, radii, shadows and breakpoints central. Component SCSS uses
`var(--p-*)`/`--p-app-*`, shared pattern classes and breakpoint mixins; no literal colors,
`.app-dark` selectors or Sakai aliases. Component-specific dimensions may stay local.
Never use shell classes in feature code. Compiled component CSS warns at 4 kB and fails at 8 kB.

## Theme

`holitaPreset(choice)` extends Aura through registered component presets.
`provideHolitaTheme` supplies it to PrimeNG with ripple disabled and makes table scroll
containers keyboard reachable. `.app-dark` is the central dark-mode selector.
Layer order is `holita-reset, primeng, holita`; keep Sass and `holitaThemeOptions` aligned.

### The configured choice

`appTheme` in `theme/theme-choice.ts` is the application's sole brand/density choice:
`{ brand: 'cobalt', density: 'compact' }`. Storybook toolbar choices affect only its preview.

### Brands

| Brand              | Primary | Neutral | Light primary / hover / active | Dark primary / hover / active |
| ------------------ | ------- | ------- | ------------------------------ | ----------------------------- |
| `cobalt` (default) | blue    | slate   | 600 / 700 / 800                | 400 / 300 / 200               |
| `ember`            | orange  | zinc    | 700 / 800 / 900                | 400 / 300 / 200               |
| `pine`             | teal    | stone   | 700 / 800 / 900                | 400 / 300 / 200               |

Brands reference Aura palette steps, not copied hex values. New names belong in the choice
unions/arrays and brand records; a new palette extends the palette union. Changed color pairs
belong in `brandContrastChecks`/`toneContrastChecks` in `theme/contrast.ts`. Text needs 4.5:1,
non-text 3:1. The Foundations stories expose the measured pairs; they are not an exhaustive
accessibility audit. Use canvas-muted tokens on canvas backgrounds, not panel muted text.

### Densities

| Value                              | `compact` (default)               | `comfortable`                 |
| ---------------------------------- | --------------------------------- | ----------------------------- |
| Form padding Y / X                 | 0.375rem / 0.625rem               | 0.5rem / 0.75rem              |
| Button padding Y / X               | 0.375rem / 0.75rem                | 0.5rem / 0.875rem             |
| Table header / body padding        | 0.5rem 0.75rem / 0.375rem 0.75rem | 0.625rem 1rem / 0.625rem 1rem |
| Table body / column-title text     | 13px / 11px                       | 14px / 12px                   |
| Row / control height               | 48px / 34px                       | 56px / 40px                   |
| Topbar height                      | 52px                              | 56px                          |
| Gutter / panel padding / stack gap | 1.25rem / 1rem / 1rem             | 1.5rem / 1.25rem / 1.25rem    |
| Page title                         | 1.375rem                          | 1.5rem                        |

### Tokens (`--p-app-*`)

| Group         | Use                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography    | Local Cyrillic-capable Lato, `font-numeric`, `text-xs/sm/table/base/md/lg/title/kpi`                                                                      |
| Space/shape   | `space-1/2/3/4/5/6/8/10`, `radius-frame/panel/control/tag`, `shadow-floating`                                                                             |
| Surfaces      | `canvas-*`, `frame-*`, `panel-*`; tinted workspace, white/dark panels and `panel-accent-*`                                                                |
| Shell         | `sidebar-*` includes dark surfaces, items/icons, groups, footer, focus and mobile drawer; `topbar-height`, `content-max-width`, `gutter`, `gutter-narrow` |
| Layout        | `stack-gap`, `control-height`, `row-height`, `drawer-width-md/lg`, `kpi-min-width`                                                                        |
| Status/series | `tone-<name>-color/background/solid`, category solids `category-c1` through `category-c8` and each slot’s `-background`/`-color` pair                     |
| Accent/plate  | Teal `accent-background/color/solid`, `hero-background/color`, `plate-background/color/border-color/band-background/band-color`                           |

Define tokens under `extend.app` in `theme/holita-preset.ts`; nested paths become kebab-case
CSS properties. Reference Aura/holita tokens centrally. Shadows are for floating surfaces.
Table column titles use the DataTable density token, not `text-xs`.

The canvas uses neutral 100/950 and the frame 50/950; panels use 0/900 with 50/800 headers
(light/dark). Sidebar tokens cover the desktop rail and mobile drawer together. Use the hero
gradient only for the sign-in side panel and dashboard header band, with `hero-color` text.
Other lead panels use `panel-accent-background/color`; the teal accent remains informational.

### Status tones and categories

Status families are success/green, info/sky, warn/amber and danger/red, plus neutral and accent.
Use `toneSeverity` for `p-tag`; neutral maps to secondary and accent to the default primary.
Vehicle groups and chart series use category slots, never arbitrary feature colors. Each slot
provides a solid graphic colour and a measured text/tint pair for icon wells and labels.
Color always accompanies text or another accessible signal. Charts retain hidden native data
tables; sparkline names state range and last value. Null is a gap, zero a real value.

### Light and dark

`Appearance` toggles the root scheme and stores `holita.admin.theme`; default is light.
Login and the account menu expose the switch. Denied storage keeps switching usable and
reports a warning. Scheme differences belong in the preset/tokens, not component selectors.
Private license/map configuration and production asset exclusions are documented once in
[development](development.md#ports-and-environment); never hide the PrimeUI license notice.

## Global styles, layers and breakpoints

Global styles load layers, fonts, breakpoint properties, reset, base, shell and patterns.
Use the central layer order instead of `!important`; reduced-motion overrides are the exception.
Local Lato weights are 400/500/600/700/800, normal only; preserve the
[font license/attribution](../apps/admin/THIRD_PARTY_NOTICES.md).

`styles/_breakpoints.scss` owns sm 640, md 768, lg 1024, xl 1280 and xxl 1536px.
SCSS uses `@use 'breakpoints' as bp` and `bp.below`/`bp.from`; TypeScript uses `ui/media.ts`
`below(name)`/`breakpointWidth(name)`, never literal pixel checks.

| Width           | Presentation                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `< sm`          | Compact topbar labels, no breadcrumb, filter search on its own row with filter conditions behind a "Filters (n)" toggle, stacked drawer actions |
| `< md`          | Full-width drawers, narrow page gutter, hidden secondary table columns, two KPI tiles per row                                                   |
| `< lg`          | Modal navigation drawer and full-bleed frame                                                                                                    |
| `≥ sm`          | Two-column form grids                                                                                                                           |
| `≥ md` / `≥ xl` | Two-/three-column card grids                                                                                                                    |
| `≥ lg`          | Settings headings beside fields                                                                                                                 |

Use focus-visible rings, the skip link and reduced-motion support. Programmatic page/drawer
focus targets need `tabindex="-1"`; do not remove visible keyboard focus.

## Shell

The shell imports no business features and fetches no business data. The workspace supplies
navigation, Branch/language/account context and page title. Navigation has no business-count badges.
The document title is `<page> · holita`; login uses the localized Sign in title.

- Dashboard is the first destination without a group heading. Fleet contains Vehicles, Devices,
  Drivers and Maintenance. System contains Commands, Settings and Tenant-wide Users. Without
  Fleet or a selected Branch, System contains Users only. Settings opens General and stays
  selected across its General | Vehicle groups tabs. Users has no Settings tabs. Dashboard opens
  Overview; its Problems and Trips tabs keep Dashboard selected. Device detail belongs to Devices.
- Desktop navigation collapses to a rail, persisted as `holita.admin.sidebar`. Rail links retain
  accessible names/group labels and hover/focus tooltips. The footer identifies holita and Tenant.
- Below 1024px, a modal drawer takes focus on Close, traps focus and closes on Escape, backdrop,
  navigation or reaching desktop width. Return focus to the menu button. Resizing preserves drafts.
- Keep the topbar one row, with Branch, language and account menus. Branch switching keeps the
  supported section/tab and clears record/list context; language switching keeps URL context.
  No Branch disables its menu with truthful loading/empty/unknown text.
- Page metadata supplies Dashboard tab, Device, Profile, Users and Notifications titles/breadcrumbs.
  Breadcrumb groups are labels, pages are
  links when a record is open, record names link to Overview from sub-tabs, and the final crumb
  uses `aria-current="page"`. Record pages register
  names/contextual return URLs with `injectPageRecord`.
  Long labels truncate with full text available. Page heading remains when narrow screens hide crumbs.
- Provide skip link, header, main, labelled navigation and group headings. Active links carry
  `aria-current`. Decorative icons are hidden from assistive technology. A page change focuses its
  title/main; drawer/tab navigation must not steal focus from the current form.
- Account actions include Profile, theme and Sign out. The workspace supplies the bell's persisted
  Branch feed, unread count, loading/error state, read actions and Notifications link. Demo sessions
  display the feed with read actions disabled. The shell performs no notification queries.
- Login has its own hero/form layout, email/password then fleet selection, explicit errors/Retry
  and language/theme controls. Development demo login is a separate development-build action.
  Session/Branch/workspace behavior belongs in [Discocan development](discocan/development.md#user-sessions).

### Texts and languages

Routes start with `/bg` or `/en`; unknown languages redirect to Bulgarian. Use BG/EN catalogs
for shell, PrimeNG texts, patterns and connected features. Preserve key/placeholder parity.
PrimeNG uses localized calendar/overlay labels, the saved Branch date format and Monday first. Source record text
is not translated. Storybook uses the same texts with a language toolbar.

## Patterns (`src/app/ui`)

Use components only for repeated structure/state/behavior. Single PrimeNG controls stay direct.
Components are standalone and OnPush, with signal inputs/outputs, `holita-` selectors and BG/EN
texts. Source files define full signatures; the table identifies which pattern to use.

| Pattern                                                           | Use and required behavior                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `holita-page-header`                                              | One page `h1` with `id="page-title"`, optional count/back link, one primary action and a complete action menu                 |
| `holita-kpi-strip` / `holita-kpi-tile`                            | Named group, optional icon/category/status tint and record link; stable loading tracks; null shows “—” without a unit         |
| `holita-filter-builder`                                           | Quick search and independent AND conditions; bounds/errors stay visible; incomplete/invalid drafts cannot apply               |
| `holita-table-panel`                                              | Shared offset/cursor/local geometry, column skeletons, retained refresh/stale rows, empty/error states, selection and actions |
| `holita-row-actions`                                              | Named row menu; send choices through `TablePanel.run`; destructive actions last                                               |
| `holita-menu-button`                                              | Accessible popup actions/navigation; real anchors for routes, current-choice labels and disabled/danger states                |
| `holita-route-drawer`                                             | Loading/missing/error/ready states, labelled Close, sticky footer, dirty/pending guards                                       |
| `holita-form-field`                                               | Label/control/hint/error association, required state and Unicode counter                                                      |
| `holita-empty-state`                                              | Empty/no-results/error/missing/disabled/no-telemetry/done; alert only for errors/missing records                              |
| `holita-column-series`, `holita-stacked-bars`, `holita-sparkline` | Accessible chart/table alternatives, null gaps and preserved zero values                                                      |

Page headers show a title and count on the left, and at most one primary action followed by the
page-action menu on the right. Define actions once with `actions`; mark the primary action with
`primary: true` and handle choices through `action`. All actions also appear in the menu. Its last
item, About this module, opens the same dialog as the information icon after the final breadcrumb.
Supply a short localized `moduleInfo` body; explanations belong in that dialog. Use the optional
`moduleInfoTitle` to name the current tab in the dialog while keeping the record's page title.

Table cells align vertically to the middle. Record links and buttons share the cell text's starting
edge; identity containers center both single-line and two-line content. Column headings wrap within
their cells to prevent overlapping adjacent headings.

Use `.app-view`, `.app-card`/`.app-card-grid`, `.app-stack`, `.app-settings-section` and
`.app-save-bar` for page layout. Cards separate direct children with a token gap;
`.app-card__body` stretches inner siblings and `.app-tab-content` provides the same outer stack
as `.app-view`. Use `.app-stack` only when children should align to the start. A card has no
outer margin. Use `.app-card--accent` for a contextual lead panel,
`.app-icon-well--<tone|c1…c8>` with `.app-icon-well` for a tinted icon, and
`.app-problem-panel--<tone>` with `.app-problem-panel` for a concise status block. Forms use `.app-form-section`/`.app-form-grid`; facts use
`<dl class="app-facts">`. Dashboard, Vehicle, Device, Settings and Notifications sections use
PrimeNG Tabs with a labelled tablist and matching tab panel. Route tabs keep their existing
destinations and unsaved-change guards; Notifications tabs use the existing All/Unread filter.
Do not recreate shared cards, menus, value meters or form layouts in a feature.

Numbers use `.app-num`, technical values `.app-mono`, statuses `p-tag`/`toneSeverity` and labelled
dots. `.app-plate` renders a bounded monospace licence plate with an EU band; set `data-country`
only when the actual registration country is known. It stays white with dark characters and a
border in both themes. Inside links/buttons or mobile metadata, put the plate on an inner span
so interactive and responsive styles do not replace its appearance.
Format through `ui/format`; preserve null and zero. Fleet read values use
`injectFleetFormat`; `dateTime`/`dateTimeCell` use the Branch zone/date format, `dateOnly` preserves
calendar dates, ranges use `dateRange`/`dateTimeRange`, and `utc` provides exact instant tooltips.
Editors use `datePickerFormat()` and the shared date-time input adapter.
Explicitly labelled canonical inputs/filters keep canonical units. Odometer
entry converts the configured display unit back to km while preserving an unchanged baseline.
Use shared zoned-time helpers for instants, with valid gap/overlap handling; date-only values
stay calendar dates. Use the configured Branch zone, never an assumed browser zone.

Form helpers provide validators, localized errors, save locking and first-invalid focus.
Projected controls set `id`, `aria-describedby`, `aria-invalid` and PrimeNG `invalid`; group
controls use labelled-by, while inner-input helpers attach metadata to the actual input.
Keep rejected drafts editable and focus their first invalid field. Never expose raw internal errors.

### Source context

`holita-source-context` presents provenance, period, coverage and availability; it owns no fetching
or actions. Keep source identity, retrieval and event clocks, gaps and missing fields distinct.

### Maps and charts

`holita-location-map` (`ui/location-map`) uses Google Maps JavaScript API for one record or a
fleet, with truck pins coloured by status, a recorded track and a matching accessible list.
Selected pins are highlighted; heading arrows appear only for fresh moving positions.
Callers establish motion with optional canonical `speedKph` or source-provided `moving`; a heading
or connection status alone never implies movement. Callers supply canonical positions, localized status labels, detail URLs, the data clock (`asOf`),
retrieval time (`updatedAt`) and Branch display preferences. A missing position stays in the list. Observation
ages advance against wall time; connection/reporting status never refreshes an older activity
or GPS observation. Activity, speed and heading become unknown beyond the Branch not-reporting
threshold. Retained recorded values and map positions show their age; expired map positions
are labelled historical and omit heading arrows.
Track points use explicit null positions or `breakBefore` to break unavailable intervals; pass the
requested range, coverage and `truncated` disclosure from the source. Selecting a marker or list
record emits `recordSelect`, pans and zooms to that truck, and opens its plate/status/position-age
popup with the detail action. Refreshes retain the view and selection; Fit fleet is explicit after
the first positioned read. A missing key or script/tile failure keeps the accessible list and its
actions available. Browser key and Map ID configuration are documented in
[development](development.md#ports-and-environment). Google external links remain available.
Review `Design System/Maps` for missing-key, fleet, single, stale, heading/track and narrow states.

`holita-chart-panel` (`ui/chart-panel`) uses `p-chart`/Chart.js for donut, line and bar summaries.
Supply localized point/series labels, canonical numeric values, units, time zone/date format,
period/as-of and a useful summary. Null values remain gaps; measured zero stays zero. Category
slots c1–c8 and explicit status tones resolve from the current tokens at runtime, including brand
and scheme changes. Reduced-motion preference disables the restrained animation. Loading/empty
states, a text legend, tooltips and a native data table are shared presentation. Set `drilldown`
to emit `pointSelect` from chart elements or matching keyboard-reachable table buttons; the host
owns navigation/filtering. Existing SVG charts remain available for small summaries. Review
`Design System/Charts` for donut, line, bar, empty, gaps, dark and loading states. PrimeNG Chart has
no Aura design tokens; its registry entry is empty and the shared canvas palette owns its colours.

### Table conventions

Every list/sub-table projects a `p-table` into TablePanel. The default `mode="offset"` keeps the
existing `page`/`pageChange` contract. Cursor history uses `mode="cursor"`,
`cursorPage={page, hasPrevious, hasNext}` and `cursorChange` (`previous`/`next`); the concrete host
owns its cursor stack and never invents a total. Finite arrays use `mode="local"` with the actual
`total`; `page` is optional when local paging is useful. No mode fetches data.

Pass explicit `columns: readonly TableColumn[]` (`id`, `label`, `width`, optional `kind` and
`className`) and `tableMinWidth` to the panel. Reuse those widths in the projected table's
`#colgroup` and set the same minimum width on `p-table`. The panel opts into fixed layout and
uses those definitions for its first-read skeleton header/rows. Column kinds are `identity`,
`text`, `status`, `date`, `number`, `problems`, `actions` and `check`; class names retain mobile
column visibility. Existing callers remain compatible until their feature package supplies columns.

Offset lists retain `lazyLoadOnInit=false`, `dataKey="id"`, scrollable content and no competing
empty-message template. Bind supported sort state and map lazy events through
`listQuery.sorted`/`injectSortReady`; `p-sort-icon` is the indicator. Use `trackById` to retain
focused row menus on refresh. Selection checkboxes need explicit accessible names.

Use `view={kind: 'loading'}` for the first read; keep existing rows with `view={kind: 'rows'}`
and `busy=true` during later reads. A later failure uses `rows-error`, retaining rows with inline Retry. First-load failures, empty and filtered-empty
states remain distinct. The loading table uses the same column definitions, density row height
and minimum width as loaded content.

Use `.app-cell-identity` for at most two truncated identity lines, `.app-cell-status` for a
bounded tag/short label, `.app-cell-date` for an instant, `.app-cell-number` for end-aligned
numbers and `.app-cell-problems` for severity/count plus a link. Simple cells remain CSS/markup.
Keep full values in `title` or the record; no full fault blocks, raw JSON, expanding details or
extra error rows in business cells. Fleet live components support `mode="table"` for compact
bounded summaries and retain their detailed record mode. Connected, Reporting and Live describe
different facts; GPS position age remains separate from frame arrival.

The scroll container is a keyboard tab stop. Secondary columns hide below md but remain in details.
Freeze the final action column right. Below sm, pin the bounded identity cell and its mobile
row menu, hide the separate action column and keep remaining columns horizontally scrollable.

Define each action once as `ListAction` with applicability, bulk/danger and confirmation metadata.
Record links, menus and bulk actions use `TablePanel.run`; no direct row Delete buttons.
Opening/editing one record is never bulk. Confirmations name applicable records and explain
unchanged selections; Cancel has initial focus. Use bounded keyboard-scrollable record lists.

Bind `actionContext` to query identity so navigation retires obsolete confirmations. Refresh/busy
state alone does not discard an enabled action. Block overlap while a write is pending.
Selection resets on query changes; after an action remove successful IDs only and retain failures.
Cancel restores trigger focus; destructive/bulk actions restore the panel heading when appropriate.

### Operation feedback

`AdminWorkspace` owns one `holita-operation-toast` outlet and scoped `MessageService`; stories use
the same presentation. Workspace changes clear messages. Publish one batch result, retaining
failed record labels/details. Success closes after five seconds; warning/error stays until dismissed.
The top-right outlet must not shift page/table layout or steal focus.

Success announces polite status; other outcomes announce alerts. Load errors, field errors,
editable-draft save errors and contextual warnings stay inline with Retry where applicable.
Retired callbacks cannot publish into a new workspace.

### PrimeNG usage rules

Add new component presets and their internal dependencies to `registeredComponents` and render
both schemes in the PrimeNG coverage story. Consult the current PrimeNG tools for component APIs.

- Name every control/overlay. ConfirmDialog uses `confirmDialogPt(language)` and message ID when
  providing custom content; Popover has an accessible label, Drawer `ariaCloseLabel`, Dialog
  `closeAriaLabel`, Autocomplete dropdown `dropdownAriaLabel`, MeterGroup an aria label.
- Multiple choice uses `p-select [multiple]="true"` with `selectMultiplePt`; do not use deprecated
  `p-multiselect`. Applied filters are FilterBuilder chips.
- Do not use `p-progressbar`; TablePanel owns the decorative refresh indicator.
- Reconcile forced-selection Autocomplete text with its selected value on focus leaving the control;
  a visible no-results panel does not by itself clear stale selection.

## List URL state

List views take `ListQuery` and emit changes; concrete hosts map them to generated API variables.
`UrlListState`/`ListDefinition` own validated URL state without fetching data. Keep backend bounds
in filter definitions, preserve independent/repeated AND conditions and reject invalid drafts.
Whole-Branch summaries stay independent of list queries. Missing data clocks remain unknown.

| Parameter          | Contract                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| `search`           | Trim/NUL removal, at most 200 code points/five words; apply after 300ms |
| `conditions`       | Validated JSON AND-condition array; entity-specific bounds              |
| `sort`, `order`    | Declared sort key and asc/desc; omit defaults                           |
| `page`, `pageSize` | One-based page, allowed size; correct out-of-range pages after totals   |
| Other filters      | Explicit codecs; validate IDs/enums/dates/numbers and omit defaults     |

Search/filter/sort/page-size changes return to page 1 and clear selection. User changes push
history; URL normalization/page correction replaces it. Preserve query/fragment and retire pending
search on external navigation. Do not apply a local default in place of absent server facts.

## Route drawers

Routed drawers are child routes over a retained list/profile, with `data.drawer`, `leaveDrawer`
and a contextual close link preserving query/fragment. Use the `ui/drawer` helpers and host
saved notifications. Host-controlled story drawers emit `closeRequest` and await dirty confirmation.

Dirty drafts ask before discard and guard unload. While saving, lock the form, prevent duplicate
submit/navigation and disable Cancel/Close. On failure retain the draft and focus invalid controls
or the drawer title. On success clear dirty state, notify the captured host and close. Destroyed
editors' writes may settle, but cannot navigate/notify another scope. Restore focus to the opener,
falling back to the page title. Keep loading, invalid ID, missing record and errors explicit.

## General settings and Fleet preferences

Use the shared full-page settings view, typed forms, titled cards and sticky save/discard bar.
Its partial-save and persisted Discard behavior is documented in
[the operator guide](discocan/development.md#fleet-operator-workflows). Gate business views on a
successful scoped preferences read with Retry. General settings saves the Branch date format,
time zone, units, thresholds and notification retention; external delivery toggles are absent.
The speed reference generates no alert or device command.

## Storybook review

Run `npm run storybook:admin` on 11001. Review real shared components with fixed fixtures;
stories are not a backend or an automatic test suite. No play functions or story runner.
Use `Admin/<menu group>/<menu item>[/<sub-page>]` in the navigation's English label/order;
shared stories belong under `Design System`.

Keep representative default/loading/empty/error/missing-scope/narrow/workflow states, aiming for
at most eight per screen. Use Language, Theme, Brand, Density and viewport toolbar globals instead
of copies. Review keyboard behavior and the Accessibility panel; the license notice is excluded
from axe and never hidden. Storybook may serve private local configuration; do not publish it.

## Changing the design centrally

1. Application look: change `appTheme` in `theme/theme-choice.ts`.
2. Token/color: change the owning theme record or `appTokens`; update the relevant contrast pairs.
3. Brand/density: update choice unions/arrays and records; extend palette unions when needed.
4. Pattern: change the shared component/CSS once and its representative stories.
5. Breakpoint: update the Sass map, test-setup restatement, `BreakpointName` and Foundations story.
6. Layer order: change `_layers.scss` and `holitaThemeOptions.cssLayer.order` together.
7. PrimeNG control: follow [usage rules](#primeng-usage-rules) and coverage stories.
8. Font weight: add its licensed WOFF under `public/fonts/lato` and the `_fonts.scss` weight entry.

Follow [focused validation](../.agents/skills/holita-focused-validation/SKILL.md) at handover;
request Storybook review when needed, including both schemes/brands/densities and mobile375.

## Extending

Use [patterns](#patterns-srcappui) and [table conventions](#table-conventions) for lists,
[URL state](#list-url-state) for queries, [route drawers](#route-drawers) for editors and
[shell](#shell) for navigation. Add no generic CRUD layer or wrapper around single controls.
