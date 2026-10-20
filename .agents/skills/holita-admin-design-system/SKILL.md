---
name: holita-admin-design-system
description: Change the holita admin design system centrally (token, brand, density, pattern), add a PrimeNG control, or build an admin screen from the shared patterns with its stories and checks. Use for any presentation change in apps/admin.
---

# Admin design system

Read [AGENTS.md](../../../AGENTS.md), the [admin design system](../../../docs/admin-design-system.md)
(the authoritative description), [ADR 0004](../../../docs/architecture/decisions/0004-admin-design-system.md)
and the [admin skill](../holita-admin-development/SKILL.md). Domain rules stay in the
[Discocan](../../../docs/discocan/instructions.md) and [Ecommerce](../../../docs/ecommerce/instructions.md)
instructions.

## Rules to check in every review

- Visual decisions live only in `src/app/theme/` and `src/styles/`. Component SCSS uses `var(--p-*)`
  and `--p-app-*` tokens, the global pattern classes and `@use 'breakpoints' as bp` mixins; no
  literal colours, no `.app-dark` selectors, no Sakai aliases (`--surface-*`, `--text-color*`) and
  no `.card`/`.page-heading` classes outside `styles/_legacy-karma.scss` and Karma's own files.
  All connected Fleet screens use the shared patterns.
- TypeScript never hard-codes a breakpoint; use `below(name)` from `ui/media.ts`.
- Use single PrimeNG controls directly; build a component in `app/ui` only for repeated
  structure, state or behaviour. No wrappers around `p-tag` and friends.
- Every component: standalone, `OnPush`, signal inputs/outputs, `holita-` prefix, texts from the
  BG/EN catalogs with a parity spec (`expectCatalogParity` from `app/i18n/catalog-parity.ts`).
  Connected Overview, Vehicles/profile/odometer, Devices, Drivers/scorecard, Alerts, Trips,
  Maintenance, Vehicle groups and General settings use BG/EN catalogs. A new connected screen gets its `bg.json`
  and parity spec with the implementation; do not leave a silent English fallback. Keep compiled component CSS below the
  4 kB warning budget (the build fails above 8 kB).
  Verify the production build's budget report, not the SCSS source-file size.
- Accessibility is a gate, not a review note: stories run axe with violations as failures. Fix a
  violation in the token, component or markup; never lower `a11y.test` or exclude elements
  (only the PrimeUI license notice is excluded, and it is never hidden).

## Change a token, brand, density or pattern centrally

1. Application look: change `appTheme` in `src/app/theme/theme-choice.ts`, nothing else.
2. Token: edit `brands.ts`, `densities.ts`, `status-tones.ts` or `appTokens` in
   `holita-preset.ts`. A changed colour pair gets a check in `brandContrastChecks` or
   `toneContrastChecks` (`theme/contrast.ts`); update the emitted values that
   `holita-preset.spec.ts` asserts.
3. New brand or density: extend the `BrandName`/`DensityName` union, the `brandNames`/`densityNames`
   arrays in `theme-choice.ts` (the specs and the toolbar's choice reader iterate them; a missing
   name is silently skipped) and the records; a new Aura palette also extends
   `AccentPalette`/`NeutralPalette`. Update the brand, contrast and density tables of the
   design-system document.
4. Pattern: change the component or CSS pattern once and update its spec and stories
   (`ui/css-patterns.stories.ts` for CSS patterns).
5. Breakpoints, layer order or font weights: follow "Changing the design centrally" in the
   design-system document (several files change together).
6. Review in Storybook (`npm run storybook:admin`, port 11001) with the toolbar: both themes, the
   three brands, both densities, desktop and `mobile375`.

## Add a PrimeNG control

1. Import its preset (and presets of controls it renders internally) into `registeredComponents`
   in `theme/holita-preset.ts`; update the sorted list in `holita-preset.spec.ts`.
2. Render it in `theme/primeng-coverage.html` in both schemes (overlays in the overlay stories) and
   update the registered-preset count (31) that the `Controls` play function asserts in
   `primeng-coverage.stories.ts`.
3. Give it an accessible name the way the design-system document lists (`ariaLabel`,
   `ariaCloseLabel`, `closeAriaLabel`, `dropdownAriaLabel`, `aria-label` on `p-metergroup`,
   `[pt]="confirmDialogPt(language)"` on `p-confirmdialog`, plus the message ID with a `#message`
   template). Do not use `p-progressbar` (its markup fails axe) or the deprecated `p-multiselect`
   (use `p-select [multiple]="true" [pt]="selectMultiplePt"` from `ui/select-multiple.ts`).
4. Run `npm run test:storybook:admin`.

## Build a screen from the patterns

- List: `holita-page-header` (single h1) → optional `holita-kpi-strip` →
  `holita-filter-builder` (quick search plus only the columns and conditions the backend
  supports) → `holita-table-panel` with a projected `p-table` (`[lazy]`,
  `[lazyLoadOnInit]="false"`, `dataKey="id"`, `[scrollable]="true"`, no `emptymessage` template,
  selection header cell with a visually hidden `<label for>` + `inputId` and an explicit
  supported `ariaLabel` when the component otherwise overrides that label,
  `[rowTrackBy]="trackById"`, cells on one line, long text in `.app-cell-truncate`, a last
  `.app-col-actions` column with `holita-row-actions` frozen right with
  `pFrozenColumn alignFrozen="right"`; never a direct Delete button in a row). The view takes a
  `ListQuery` input (`ui/list/list-query.ts`), changes it through the `listQuery` transitions
  (sort through `listQuery.sorted` behind `injectSortReady()`) and emits `stateChange`; the view
  state comes from `tableView(...)`. Follow live `VehiclesPage` and `vehicle-query.ts` for
  `UrlListState` with a `ListDefinition`, explicit condition-to-contract mapping and debounced
  URL search. Map only the backend's supported independent `allOf` predicates and sort fields;
  cap conditions/selections to their contract bounds. Load full relation choices with bounded
  pages. Numeric fields declare real min/max/integer or `decimalPlaces` precision; Maintenance
  EUR filters use two decimals and exact integer cents, never silently drop fractional-cent
  input. Preserve the server's nullable clock and derived activity/fuel/urgency classifications.
- List actions: define them once as `ListAction<Id, Row>[]` (`bulk` only for quick changes,
  `danger`, `confirm`, `appliesTo(row)` as the only applicability rule), map rows with
  `listRecord`, pass `[actions]` and `[selection]` to the panel, and start every action — record
  link, row menu, bulk bar — through `TablePanel.run`. The panel confirms and filters; the host
  handles the single `action` output. Vehicles delete/deactivate, Devices/Drivers delete,
  Alerts acknowledge and Maintenance cancel/delete use one IDs-array mutation for both a row
  and a selection; Vehicle groups retains protected single-record deletion. The view clears the selection on every query change
  and the host removes only successful IDs after an action; failed selections stay for retry.
  Publish the result through the shared `OperationToast` and workspace `MessageService`.
  Bind `[actionContext]` to the current query identity; the panel retires pending confirmations
  on context changes and destroy. `confirmAction` accepts an optional `AbortSignal` and resolves
  `false` on cancellation, including an already-aborted signal.
  Do not add a host `p-confirmdialog` or check applicability again.
- Editor: a right-hand drawer. The default opens the row straight into its form; a read-only
  record uses a view drawer; a complex record may open as a view whose Edit button switches the
  same drawer to the form. Drivers uses routed read/edit with Cancel returning to its record;
  Maintenance dispatches planned editing, read-only DONE/CANCELLED history and completion to
  its existing drawers. Sample hosts use `[closeLink]="null"` with `closeRequest` →
  `await drawer.confirmLeave(dirty)` → their own `closed` output. Live `VehicleEditorPage`
  supplies the absolute list `closeLink` to `VehicleDrawer`; the route's `leaveDrawer` guard
  asks once through `canLeave()`, and `injectDrawerHost()` reports a successful save to the
  retained list. Build a typed Reactive Form in
  `.app-form-section` / `.app-form-grid` with `holita-form-field`, maps server errors with
  `errorCode`/`fieldErrors`, and focuses the first invalid field (`focusFirstInvalid`). A routed
  drawer (child route with `data: { drawer: true, mode, recordParam }`,
  `canDeactivate: [leaveDrawer]`, `canLeave()` and `injectDrawerHost()`) uses `ui/drawer`;
  Vehicles, Groups, Drivers and Maintenance are concrete live references. Profile edit reuses
  the same Vehicle editor and returns to its active tab. Keep loading/error/missing/invalid-ID
  states and an independently captured editor client; hydrate fields once and preserve failed
  drafts. Disable submitted forms and focus server-invalid controls even after a synchronous
  failure without a visible saving frame.
- Detail: page header with `backLink`, `injectPageRecord` for the breadcrumb, `.app-card` /
  `.app-card-grid`, `.app-facts`, charts from `ui/charts`.
- Format every value with `ui/format` (null → "—"), statuses with `p-tag` and `toneSeverity`.
  Live Fleet read values and charts use the workspace's `FLEET_DISPLAY` signal and
  `injectFleetFormat()` for configured units/time zone. Typed editors and filters retain
  explicitly labelled canonical entry units and precision; do not feed rounded display values
  back into API inputs. Keep zero distinct from missing measurements.
- General settings reuses its full-page cards/sticky save bar, with field errors and guarded
  drafts. Preserve saved canonical Fleet values if the separate Core name mutation fails:
  retain the rejected name, report partial success and make Discard restore the actual saved
  baseline. Live notification switches are disabled and labelled Demo/unavailable, and are
  excluded from writes. Explain the speed limit as a stored reference without alert generation.
- Connected screens display actual contracts. Device restart, firmware policy and hardware
  signal/voltage remain unavailable; only labelled Demo examples simulate these. Preserve
  no-telemetry states in Overview/profile/scorecard. A manual odometer reading does not invent
  device activity or advance the telemetry clock, and a service odometer remains service
  history. The General sample remains separate from its live routed container; notification
  delivery remains unavailable in both the live settings page and the Demo shell bell.

## Connect a screen and its live story

Reuse the presentation-only feature view/drawer and add a concrete routed adapter, feature API,
named operations and explicit query/mapping beside them. Application code never imports
`src/storybook`; generated operations/types remain the Gateway boundary. Follow the actual
screen entry points in the [admin skill](../holita-admin-development/SKILL.md#trace-the-concrete-implementation).
Keep shared operation feedback in `AdminWorkspace` rather than per-page providers.

Add an `Admin/<Group>/<Screen>` story beside the adapter using `routeAt`, `StoryApp`, a seeded
session and `satisfies StoryFixtures`. Register typed `graphqlFixture` snapshots in a
screen-specific `src/storybook/*-fixtures.ts` and import that registry from `story-config.ts`.
Exercise real routes, services, drawer saves, unavailable states and controlled failures.
Fixtures keep immutable read responses: refetch after a write returns the same documented
snapshot. Prove persistence/filter calculations with database/browser checks; do not build a
second backend store or query engine in Storybook. Eagerly importing the real lazy component
graph into that story's `moduleMetadata.imports` prepares cold Vite compilation before play
without changing production routes.

## Add an example page

1. Build the presentation-only view and drawer in `src/app/features/<domain>/<feature>/`: inputs
   and outputs only, texts from the feature's supported catalogs. Existing examples retain
   their separate sample hosts; do not replace a connected adapter with sample behavior.
2. Add a story host `src/storybook/samples/pages/<name>-page.ts` (selector
   `holita-example-<name>-page`). It reads `injectQueryParams()`, picks its state with
   `scenarioOf(params, [...])`, closes drawers with `injectClearDrawer()`, simulates saves with
   `saveDelayMs`, takes rows from `samples/fleet-samples.ts` (mapped in `samples/rows.ts`) and
   lists them with `runSampleList`, a `SampleListDefinition`, `initialQuery` and
   `sampleTableView` (`samples/sample-list.ts`). Pick sample records by ID or predicate; changing
   a generator shifts records and breaks play functions and visual captures.
3. Register `examples/<path>` in `samples/pages/example-routes.ts` and add the item to
   `exampleNavigation` in `samples/example-app.ts` (the Tour story visits every item).
4. Put the story file beside the view: title `Examples/<Group>/<Page>`, `tags: ['!autodocs']`,
   `render: exampleAt('<path>?scenario=…&drawer=…')`. Add a new group to `storySort` in
   `.storybook/preview.ts`.
5. Add the page to the examples list in `src/storybook/introduction.stories.ts`, its captures to
   `tools/browser/storybook-visual.spec.mts` and its row and query values to "Storybook review" in
   the design-system document.

Story conventions: wait for the actual interaction's loaded state with
`waitFor(..., { timeout: 10_000 })` before asserting or editing. A drawer title alone can precede
field hydration; wait for a known field value. For bulk actions, wait for the accessible named
enabled checkbox and checked/selected state before using the enabled action. Do not use
`hidden: true` or bypass a control's accessible name to hide a failure. PrimeNG drawers, dialogs and menus render into the body, so query them with
`within(canvasElement.ownerDocument.body)`, and choose `p-menu` items with
`chooseMenuItem(body, label)` (`src/storybook/interactions.ts`; p-menu ignores clicks on the
`menuitem` element). Wrap visibility and focus assertions after PrimeNG animations in `waitFor`.
Export the error story as `ErrorState` with `name: 'Error'`. Pin a viewport or theme with
`globals: { viewport: { value: 'mobile375', isRotated: false } }` or `globals: { theme: 'dark' }`.
Undo storage writes and spies in a story `beforeEach` cleanup, and type fixture parameters with
`satisfies StoryFixtures`.

## Required stories and checks

- Stories beside each new component (`Design System/...`), live screen (`Admin/...`) or sample screen (`Examples/...`): every list
  state, drawer state and the error and empty variants, in English (Storybook has one language);
  play functions for flows.
- Unit specs for helpers and components (`npm run test:admin -- --include=... --skip-nx-cache`);
  `src/test-setup.ts` provides breakpoints, a `matchMedia` that reports reduced motion,
  `ResizeObserver` and `scrollIntoView` in jsdom.
- Select concrete changed adapter/query/mapping/editor cases from the
  [Fleet screen selectors](../../../docs/discocan/testing.md#connected-fleet-screens), and
  shared `app/ui/filter-builder/filter-model.spec.ts`, `app/ui/table-panel/table-panel.spec.ts`
  or `app/ui/drawer/route-drawer.spec.ts` when their behavior changes. Real connected workflows
  use `npm run test:smoke:admin -- angular-fleet.smoke.spec.mts` with a focused native `--grep`;
  Vehicles/Devices also retain their dedicated smoke files.
- `npm run test:storybook:admin`, `npm run test:visual:admin` (candidates for a person to review;
  baselines only after approval) and, when the shell changes, the workspace and catalog specs
  (`--include="app/workspace/**/*.spec.ts" --include="app/i18n/**/*.spec.ts"`) and the shell smoke
  (`npm run test:smoke:admin -- angular-shell.smoke.spec.mts`; see
  [browser smoke checks](../../../docs/testing.md#real-federation-and-browser-smoke-checks)). Follow
  [focused validation](../holita-focused-validation/SKILL.md) for everything else.
