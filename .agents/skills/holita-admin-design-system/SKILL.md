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
  and `--p-app-*` tokens, the global pattern classes and `@use 'breakpoints'` mixins; no literal
  colours, no `.app-dark` selectors, no Sakai aliases (`--surface-*`, `--text-color*`) and no
  `.card`/`.page-heading` classes outside `styles/_legacy-karma.scss` and Karma's own files.
- TypeScript never hard-codes a breakpoint; use `below(name)` from `ui/media.ts`.
- Use single PrimeNG controls directly; build a component in `app/ui` only for repeated
  structure, state or behaviour. No wrappers around `p-tag` and friends.
- Every component: standalone, `OnPush`, signal inputs/outputs, `holita-` prefix, texts from the
  BG/EN catalogs with a parity spec. Keep each component stylesheet below 4 kB.
- Accessibility is a gate, not a review note: stories run axe with violations as failures. Fix a
  violation in the token, component or markup; never lower `a11y.test` or exclude elements
  (only the PrimeUI license notice is excluded).

## Change a token, brand, density or pattern centrally

1. Application look: change `appTheme` in `src/app/theme/theme-choice.ts`, nothing else.
2. Token: edit `brands.ts`, `densities.ts`, `status-tones.ts` or `appTokens` in
   `holita-preset.ts`. A changed colour pair gets a check in `theme/contrast.ts`; the preset spec
   asserts emitted tokens.
3. New brand or density: extend the `BrandName`/`DensityName` unions and the records; Storybook
   toolbar items, preset spec and contrast spec iterate them.
4. Pattern: change the component or CSS pattern once and update its spec and stories.
5. Review in Storybook (`npm run storybook:admin`, port 11003) with the toolbar: both themes, both
   languages, the three brands, both densities, desktop and `mobile375`.

## Add a PrimeNG control

1. Import its preset (and presets of controls it renders internally) into `registeredComponents`
   in `theme/holita-preset.ts`; update the list in `holita-preset.spec.ts`.
2. Render it in `theme/primeng-coverage.html` in both schemes (overlays in the overlay stories).
3. Give it an accessible name the way the design-system document lists (`ariaLabel`,
   `ariaCloseLabel`, `closeAriaLabel`, `dropdownAriaLabel`, `aria-label` on `p-metergroup`,
   `[pt]="confirmDialogPt(language)"` on `p-confirmdialog`). Do not use `p-progressbar` (its
   markup fails axe) or the deprecated `p-multiselect` (use `p-select [multiple]="true"`).
4. Run `npm run test:storybook:admin`.

## Build a screen from the patterns

- List: `holita-page-header` (single h1) → optional `holita-kpi-strip` →
  `holita-filter-builder` (quick search plus only the columns and conditions the backend
  supports) → `holita-table-panel` with a projected `p-table` (`[lazy]`, `dataKey="id"`, no
  `emptymessage` template, selection header cell with a visually hidden `<label for>` + `inputId`,
  long text in `.app-cell-truncate`, a last `.app-col-actions` column with `holita-row-actions`;
  never a direct Delete button in a row). State comes from `UrlListState` with a
  `ListDefinition`; the view from `tableView(...)`; bulk writes use `runSequential`; destructive
  actions `confirmDestructive` with a `p-confirmdialog` using `confirmDialogPt`.
- Editor: a right-hand drawer. The default opens the row straight into its form; a read-only
  record uses a view drawer; a complex record may open as a view whose Edit button switches the
  same drawer to the form. In the app it is a child route with
  `data: { drawer: true, mode, recordParam }` and `canDeactivate: [leaveDrawer]`; the component
  renders `holita-route-drawer` (or `[closeLink]="null"` with `closeRequest` where no route
  exists), implements `canLeave()` with `confirmLeave(dirty)`, builds a typed Reactive Form in
  `.app-form-section` / `.app-form-grid` with `holita-form-field`, maps server errors with
  `errorCode`/`fieldErrors`, focuses the first invalid field and reports saves through
  `injectDrawerHost()`.
- Detail: page header with `backLink`, `.app-card` / `.app-card-grid`, `.app-facts`, charts from
  `ui/charts`.
- Format every value with `ui/format` (null → "—"), statuses with `p-tag` and `toneSeverity`.

## Required stories and checks

- Stories beside each new component (`Design System/...`) or screen (`Screens/...`): every list
  state, drawer state and the error and empty variants, in English (Storybook has one language);
  play functions for flows. Stories wait (`waitFor`) for routed content before they assert, so axe
  checks real content.
- Unit specs for helpers and components (`npm run test:admin -- --include=... --skip-nx-cache`);
  `src/test-setup.ts` provides breakpoints, `matchMedia` and `ResizeObserver` in jsdom.
- `npm run test:storybook:admin`, `npm run test:visual:admin` (candidates for a person to review;
  baselines only after approval) and the shell smoke when the shell changes
  (`npm run test:smoke:admin -- angular-shell.smoke.spec.mts`). Follow
  [focused validation](../holita-focused-validation/SKILL.md) for everything else.
