---
name: osnova-admin-design-system
description: Apply the shared design system to any presentation change in discocan/apps/admin.
---

# Admin design system

Use standalone OnPush components, signal inputs and outputs, accessible names and the BG/EN catalogs. Keep component CSS under the 4 kB warning budget. Use PrimeNG controls directly; add a shared UI component only for repeated structure, state or behavior.

- Visual decisions belong in `osnova/packages/ui/src/theme/` and `osnova/packages/ui/src/styles/`. Component styles use `var(--p-*)` and `--p-app-*` tokens, `.app-*` patterns and `@use 'breakpoints' as bp`. Never use literal colours, `.app-dark`, Sakai aliases, `.card` or `.page-heading`. Use `below(name)` from `ui/media.ts` for TypeScript breakpoints.
- Font sizes and families, radii and shadows use tokens. Spacing uses `--p-app-space-*` or the density tokens `--p-app-stack-gap` and `--p-app-panel-padding`; zero, 1px and percentages are allowed. Run `npm run check:admin-styles` for the enforced rules and documented exceptions.
- Register each new PrimeNG control and its dependencies in `osnova/packages/ui/src/theme/ui-preset.ts` and render it in `osnova/packages/ui/src/design/design-page.html` in both schemes. Use `p-select [multiple]="true"` with `selectMultiplePt`; do not use `p-progressbar` or deprecated `p-multiselect`.
- Change brand, density and tokens centrally in `theme/`; update the design-system document when a public choice changes and check changed colour pairs in `osnova/packages/ui/src/theme/contrast.ts`.

## Screen recipes

- **List:** `osnova-page-header`, optional `osnova-kpi-strip`, `osnova-filter-builder`, and `osnova-table-panel` with a projected lazy `p-table`. Define `ListAction`s once, use `osnova-row-actions` and start actions through `TablePanel.run`.
- **Editor:** a routed right-hand `ui/drawer` with `leaveDrawer`, a typed Reactive Form, `.app-form-section` / `.app-form-grid` and `osnova-form-field`.
- **Detail:** `osnova-page-header` with `backLink`, `.app-card` / `.app-card-grid`, `.app-facts` and `ui/charts`.

Format values with `ui/format`, use `p-tag` and `toneSeverity` for status, and `injectFleetFormat()` for Fleet reads. Keep editor and filter values in canonical units.

A new shared pattern in `osnova/packages/ui/src/ui` adds one block to the development `/:language/design` page; screens add nothing. Review presentation changes in the running development app at desktop width and 375 px, including light and dark appearance.
