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
  no `.card`/`.page-heading` classes outside `styles/_legacy-karma.scss`, Karma's own files and the
  pre-pattern Fleet Vehicles/Devices screens (`FleetWorkspace` and its pages and editors).
- TypeScript never hard-codes a breakpoint; use `below(name)` from `ui/media.ts`.
- Use single PrimeNG controls directly; build a component in `app/ui` only for repeated
  structure, state or behaviour. No wrappers around `p-tag` and friends.
- Every component: standalone, `OnPush`, signal inputs/outputs, `holita-` prefix, texts from the
  BG/EN catalogs with a parity spec (`expectCatalogParity` from `app/i18n/catalog-parity.ts`).
  The Storybook-only Fleet view catalogs (`features/fleet/*/i18n`) are English-only with an
  English fallback; a screen wired into the application first gets its `bg.json` and a parity
  spec. Keep each component stylesheet below 4 kB.
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
6. Review in Storybook (`npm run storybook:admin`, port 11003) with the toolbar: both themes, the
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
  selection header cell with a visually hidden `<label for>` + `inputId`,
  `[rowTrackBy]="trackById"`, cells on one line, long text in `.app-cell-truncate`, a last
  `.app-col-actions` column with `holita-row-actions` frozen right with
  `pFrozenColumn alignFrozen="right"`; never a direct Delete button in a row). The view takes a
  `ListQuery` input (`ui/list/list-query.ts`), changes it through the `listQuery` transitions
  (sort through `listQuery.sorted` behind `injectSortReady()`) and emits `stateChange`; the view
  state comes from `tableView(...)`. `UrlListState` with a `ListDefinition` is the tested helper
  for a host that keeps the query in the URL.
- List actions: define them once as `ListAction<Id, Row>[]` (`bulk` only for quick changes,
  `danger`, `confirm`, `appliesTo(row)` as the only applicability rule), map rows with
  `listRecord`, pass `[actions]` and `[selection]` to the panel, and start every action — record
  link, row menu, bulk bar — through `TablePanel.run`. The panel confirms and filters; the host
  handles the single `action` output (bulk writes with `runSequential`), the view clears the
  selection on every query change and the host removes only the records an action changed from
  it. Do not add a host `p-confirmdialog` or check applicability again.
- Editor: a right-hand drawer. The default opens the row straight into its form; a read-only
  record uses a view drawer; a complex record may open as a view whose Edit button switches the
  same drawer to the form. The component renders `holita-route-drawer` with `[closeLink]="null"`:
  `closeRequest` → `await drawer.confirmLeave(dirty)` → its own `closed` output (every editing
  `features/fleet/*/*-drawer.ts` works this way; the read-only trip drawer emits `closed` directly). It
  builds a typed Reactive Form in
  `.app-form-section` / `.app-form-grid` with `holita-form-field`, maps server errors with
  `errorCode`/`fieldErrors`, and focuses the first invalid field (`focusFirstInvalid`). A routed
  drawer (child route with `data: { drawer: true, mode, recordParam }`,
  `canDeactivate: [leaveDrawer]`, `canLeave()` and `injectDrawerHost()`) is supported by
  `ui/drawer` and covered by its specs (`injectDrawerHost()` has none); no screen uses it.
- Detail: page header with `backLink`, `injectPageRecord` for the breadcrumb, `.app-card` /
  `.app-card-grid`, `.app-facts`, charts from `ui/charts`.
- Format every value with `ui/format` (null → "—"), statuses with `p-tag` and `toneSeverity`.

## Add an example page

1. Build the presentation-only view and drawer in `src/app/features/<domain>/<feature>/`: inputs
   and outputs only, texts from the feature's `i18n/en.json`.
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

Story conventions: wait for routed content with `waitFor(..., { timeout: 10_000 })` before
asserting. PrimeNG drawers, dialogs and menus render into the body, so query them with
`within(canvasElement.ownerDocument.body)`, and choose `p-menu` items with
`chooseMenuItem(body, label)` (`src/storybook/interactions.ts`; p-menu ignores clicks on the
`menuitem` element). Wrap visibility and focus assertions after PrimeNG animations in `waitFor`.
Export the error story as `ErrorState` with `name: 'Error'`. Pin a viewport or theme with
`globals: { viewport: { value: 'mobile375', isRotated: false } }` or `globals: { theme: 'dark' }`.
Undo storage writes and spies in a story `beforeEach` cleanup, and type fixture parameters with
`satisfies StoryFixtures`.

## Required stories and checks

- Stories beside each new component (`Design System/...`) or screen (`Examples/...`): every list
  state, drawer state and the error and empty variants, in English (Storybook has one language);
  play functions for flows.
- Unit specs for helpers and components (`npm run test:admin -- --include=... --skip-nx-cache`);
  `src/test-setup.ts` provides breakpoints, a `matchMedia` that reports reduced motion,
  `ResizeObserver` and `scrollIntoView` in jsdom.
- `npm run test:storybook:admin`, `npm run test:visual:admin` (candidates for a person to review;
  baselines only after approval) and, when the shell changes, the workspace and catalog specs
  (`--include="app/workspace/**/*.spec.ts" --include="app/i18n/**/*.spec.ts"`) and the shell smoke
  (`npm run test:smoke:admin -- angular-shell.smoke.spec.mts`; the signed-in admin smokes
  currently fail; see [browser smoke checks](../../../docs/testing.md#real-federation-and-browser-smoke-checks)). Follow
  [focused validation](../holita-focused-validation/SKILL.md) for everything else.
