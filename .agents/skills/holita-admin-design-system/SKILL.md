---
name: holita-admin-design-system
description: Change the holita admin design system centrally (token, brand, density, pattern), add a PrimeNG control, or build an admin screen from the shared patterns. Use for any presentation change in apps/admin.
---

# Admin design system

Read [AGENTS.md](../../../AGENTS.md) and the [admin skill](../holita-admin-development/SKILL.md).
The [admin design system](../../../docs/admin-design-system.md) is the authoritative description;
open only the section you need.

## Rules

- Visual decisions live only in `src/app/theme/` and `src/styles/`.
  - Component SCSS uses `var(--p-*)` and `--p-app-*` tokens, the global pattern classes and the
    `@use 'breakpoints' as bp` mixins.
  - Never use literal colours, `.app-dark` selectors or Sakai aliases (`--surface-*`,
    `--text-color*`).
  - Never use `.card`/`.page-heading` classes outside `styles/_legacy-karma.scss` and Karma's own
    files.
- TypeScript never hard-codes a breakpoint. Use `below(name)` from `ui/media.ts`.
- Use single PrimeNG controls directly. Build a component in `app/ui` only for repeated
  structure, state or behaviour, and don't wrap `p-tag` and similar controls.
- Every component is standalone and `OnPush`, uses signal inputs/outputs and the `holita-` prefix,
  and takes its texts from the BG/EN catalogs. A new connected screen gets its `bg.json` with the
  implementation, so English is never a silent fallback.
- Keep compiled component CSS below the 4 kB warning budget (the build fails above 8 kB).
- Give every control an accessible name. Check a screen with the Storybook Accessibility panel
  when its markup changes.

## Change a token, brand, density or pattern centrally

1. **Application look:** change only `appTheme` in `src/app/theme/theme-choice.ts`.
2. **Token:** edit `brands.ts`, `densities.ts`, `status-tones.ts` or `appTokens` in
   `holita-preset.ts`. A changed colour pair gets a check in `theme/contrast.ts`.
3. **New brand or density:** extend the `BrandName`/`DensityName` union, the
   `brandNames`/`densityNames` arrays and the records. Update the tables in the design-system
   document.
4. **Pattern:** change the component or CSS pattern once.
5. **Breakpoints, layer order or font weights:** follow "Changing the design centrally" in the
   design-system document, because several files change together.
6. **Review:** open Storybook (`npm run storybook:admin`, port 11001) with the toolbar themes,
   brands, densities and `mobile375`.

## Add a PrimeNG control

1. Import its preset, and the presets of the controls it renders, into `registeredComponents` in
   `theme/holita-preset.ts`.
2. Render it in `theme/primeng-coverage.html` in both schemes.
3. Give it an accessible name as the design-system document lists.
4. Use neither `p-progressbar` nor the deprecated `p-multiselect`. Use
   `p-select [multiple]="true"` with `selectMultiplePt` instead.

## Build a screen from the patterns

- **List:**
  - Structure: `holita-page-header`, then an optional `holita-kpi-strip`, then
    `holita-filter-builder`, then `holita-table-panel` with a projected lazy `p-table`.
  - Row actions go through `holita-row-actions`. Never put a direct Delete button in a row.
  - Define the actions once as `ListAction` and start every action through `TablePanel.run`.
  - Follow `VehiclesPage` and `vehicle-query.ts`.
- **Editor:** a right-hand drawer with a typed Reactive Form in `.app-form-section` /
  `.app-form-grid` with `holita-form-field`. Routed drawers use `ui/drawer` with the `leaveDrawer`
  guard. Vehicles, Groups, Drivers and Maintenance are the references.
- **Detail:** a page header with `backLink`, `.app-card` / `.app-card-grid`, `.app-facts` and the
  charts from `ui/charts`.
- **Values:**
  - Format every value with `ui/format`, so null shows as "—".
  - Show statuses with `p-tag` and `toneSeverity`.
  - Fleet read values use `injectFleetFormat()`.
  - Editors and filters keep canonical units.

## Stories

Stories are a development tool and are not tests:

- Add an `Admin/<Group>/<Screen>` story beside a connected adapter. Use `routeAt`, `StoryApp` and
  typed `graphqlFixture` snapshots in `src/storybook/*-fixtures.ts`.
- Add a `Design System/...` story beside a new shared component.
- Do not add play-function assertions, and do not build a second backend in Storybook.
