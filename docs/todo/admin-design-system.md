# Admin design system

Open work for a centrally controlled admin design that new modules reuse, reviewed in the
[admin Storybook](../development.md#admin-storybook) before it reaches application screens. The
work continues on the `feature/admin-design-system` branch (find its worktree with
`git worktree list`). The implemented design system, shell and Storybook are described in
[docs/admin-design-system.md](../admin-design-system.md) and
[ADR 0004](../architecture/decisions/0004-admin-design-system.md); the Fleet list contract and the
implemented Fleet backend in the [Discocan documents](../discocan/README.md) and
[ADR 0005](../architecture/decisions/0005-fleet-list-contract-and-derived-values.md). This file
holds the decisions for the remaining work and the open tasks. The build plans are the
[frontend spec](admin-design-system-frontend.md) (phases in its section 11) and the
[backend spec](admin-design-system-backend.md) (slices in its section 13); the introduction of
each spec says which of its sections are superseded by those documents.

## Decisions agreed with the user

- Keep PrimeNG 22 with its styled-mode tokens. The organisation qualifies for the PrimeUI
  Community license. A developer's key lives only in the Git-ignored
  `apps/admin/public/config.local.json`, which the application and the interactive Storybook
  read; build outputs must not carry it. The license notice is never hidden with CSS or
  JavaScript.
- The current admin presentation is not a reference. Design a new, better visual language from
  the actual data flows; Meridian (meridian.primeuipro.dev, a Nuxt/PrimeVue showcase) is visual
  inspiration only, never a source of code or assets.
- Keep light and dark themes and Bulgarian/English in the application. Brand tokens (color,
  neutrals, density, font, shell geometry) are undecided and must stay easy to change centrally
  (`appTheme`).
- Storybook first (2026-10-18): finish and review a complete English-only Storybook before the
  admin wiring and the backend continue; the real admin and its smoke tests may stay broken
  meanwhile. The shell previews and example pages offer sample languages that change nothing.
- Example pages use sample data in stories (no GraphQL). They must be replaceable by
  Apollo-backed containers that feed the same `features/fleet/*` views and drawers.
- Editing happens in a right-hand drawer: direct edit by default, a view drawer for read-only
  records, and a view drawer with Edit for complex records.
- Filters are AND-only; the quick search is the fastest filter and is always visible.
- List actions are defined once for the row menu and the bulk bar. Bulk actions are the quick,
  small changes (deactivate, delete, acknowledge, restart); opening or editing one record is never
  bulk. Destructive actions confirm in a modal that names the record or lists the selection.
- Topbar: no visible Branch label; Branch and language are popup menus like the row menu, not
  selects; an account (profile) menu and notifications, with sample data in Storybook until the
  backend has them.
- The breadcrumb stays on one line with maximum widths; from a record page the list page is a
  link.
- Paging stays visible whenever rows are shown, so any page size can be chosen again.
- Karma Client is temporary; do not redesign or build on it.
- Develop the Discocan Fleet domain into a rich demo and test bed with synthetic data,
  scenarios and new tables where useful. Backend list APIs may change, but must follow one
  standard contract (pagination, sorting, filtering, search) rather than serve one screen.
- The design system is shared by both domains' future admin screens.
- Approved screenshot baselines stay local and ignored; visual checks stay out of CI for now.
  Baselines are recorded or updated only after the user approves the candidates.
- Work in small phases with minimal, focused diffs. End each phase with a short report to the
  user in Bulgarian and one commit on `feature/admin-design-system`.
- Never push, merge or amend. Never edit, build or run anything in the main checkout (the
  worktree of `main`).
- Never stage editor swap files (`*.swp` is not ignored), and never read, print, commit or
  publish `apps/admin/public/config.local.json`.

## Open tasks

Work through the tasks below in order. Apart from "Storybook first" and the open decisions in
[review fixes](admin-design-system-review-fixes.md#decisions-needed-from-the-user) (including the
merge scope), the order follows the specs' dependencies (F2's operation registration and gate
wait for B3, F4 for B4). Run every build, generation, test and server command one at a time; the
specs' check lock matters only when agents run in parallel. Choose checks with [testing](../testing.md), the
[design-system checks](../admin-design-system.md#changing-the-design-centrally) and the gates of
the specs. Known Storybook and test behaviour (overlays in `document.body`, seeded samples, cached
static builds, current smoke failures) is described in [testing](../testing.md) and the
[admin Storybook](../development.md#admin-storybook) section.

### Storybook review

The user reviews the Storybook (`npm run storybook:admin`, `http://127.0.0.1:11003`, starting at
"Start here") and gives feedback; implement it in small phases. Start from
[Storybook review](../admin-design-system.md#storybook-review), the stories beside the components
(`apps/admin/src/app/**/*.stories.ts`) and the example pages in `apps/admin/src/storybook/samples`.

### Review fixes

The verified fixes from the external review of this branch are planned in
[review fixes](admin-design-system-review-fixes.md): documentation corrections, the PrimeUI key
out of the build outputs (the Storybook `assets` options are no-ops, so the static build must stop
copying Vite's public directory and copy only the fonts), editors locked while saving, required
General settings fields, FilterBuilder focus, serialized odometer readings and driver/vehicle
writes, and the trip in-progress upper bound. Its last section lists the decisions they need,
including which tasks must precede a merge.

### Visual candidates and baselines

Keep the PrimeUI key out of the build outputs first
([R1](admin-design-system-review-fixes.md#r1-primeui-key-out-of-build-outputs)), so that the
captures show the final key state (the license notice). After the user approves the look, delete
`test-results/storybook-visual-candidates/` and run `npm run test:visual:admin` for fresh
candidates. The user reviews them; only then record the first baselines with the command in
[Storybook visual review](../testing.md#storybook-visual-review).
The captures are listed in `tools/browser/storybook-visual.spec.mts`.

### Smoke rewrite for the menu topbar

The topbar is one row of `holita-menu-button` menus: a Branch button named "Branch: <name>"
("Клон: …"), a language button ("Language: …"), the bell (hidden in the application) and the
account button, whose menu holds the theme switch and Sign out. Options are `menuitem`s; choose
them by their label text (p-menu handles clicks on the item content). The browser smokes still
use the old controls, so every signed-in smoke fails until this rewrite and `test:full` stops
before the story tests ([browser smoke checks](../testing.md#real-federation-and-browser-smoke-checks)).
The login page keeps its Tenant and Branch comboboxes, language link and theme button; those
locators stay valid.

- `tools/browser/angular-fixture.mts:8-18` `chooseBranch`: open the Branch menu button and choose
  the `menuitem` (used by the foundation, Vehicles, Devices, shell, Karma and eData smokes).
- Language links (`getByRole('link', { name: 'Български' })`) become "open the language menu,
  choose Български/English": foundation :67, :171; karma :57, :114; karma-phase2 :77, :159;
  karma-phase3 :71; karma-phase4 :100; edata :45; shell :213, :357.
- Theme buttons while signed in become "open the account menu, choose the theme item": karma :45;
  karma-phase2 :65, :185; karma-phase3 :26; karma-phase4 :38, :183; edata :128; vehicles :71, :99;
  devices :129; shell :220, :248, :259, :339, :352, :366.
- Sign out: shell :214 (button) and tenants :52 (`demo-logout`) become "account menu, Sign out".
- Branch combobox reads: shell :162, :212, :363, :380 and tenants :56 read the Branch menu button.
- Shell tests to rewrite (`angular-shell.smoke.spec.mts`): "one Branch selector keeps editor
  drafts across widths, on a second row below sm" (one row at every width); "keyboard order and
  visible focus…" (skip link, menu button, topbar logo below `lg` only, Branch, language, account,
  then the sidebar logo and the first navigation link); "mobile navigation drawer…"; "theme
  persists and the language link keeps path, query and fragment"; "branch selection works with
  the keyboard…".
- When the smokes pass, remove the smoke limitation from
  [testing](../testing.md#real-federation-and-browser-smoke-checks) and update the shell row of
  [frontend 8.2](admin-design-system-frontend.md#8-tests).

### Backend B3 and B4

- B3 Overview: KPIs, attention queue and window aggregates; reconcile the SDL with the Overview
  example first ([backend 13](admin-design-system-backend.md#b3-overview)). Nothing exists yet
  (no `apps/fleet/src/modules/overview`).
- B4 Demo seed and documentation completion
  ([backend 13](admin-design-system-backend.md#b4-demo-seed-and-documentation-completion)). There
  is no `apps/fleet/prisma/demo` and no `db:seed:fleet-demo` yet.

### F2 Fleet scaffolding

Route tree with drawer child routes, keyed outlet, reuse strategy, scoped clients, shared Fleet
folder and navigation, and retirement of the old Fleet screens
([frontend 11](admin-design-system-frontend.md#f2-fleet-scaffolding)). The parameter-keyed route
reuse strategy and the per-page/drawer Apollo clients are planned in
[frontend 4.2](admin-design-system-frontend.md#42-reuse-keying-and-apollo-client-ownership) and do
not exist yet.

- `apps/admin/src/app/features/fleet/fleet.routes.ts` still routes `/:branchId/fleet/vehicles`
  and `/devices` (with `/new` and `/:recordId/edit`) through `FleetWorkspace` to the old
  `VehiclesPage`, `DevicesPage`, full-page editors and `RelationPicker`. They use none of the
  B1/B2 fields, and `styles/_legacy-karma.scss` maps their legacy classes to tokens. Navigation
  has Fleet (Vehicles, Devices) and Karma Client. Retire the old screens, editors and
  `RelationPicker` ([frontend 9.1](admin-design-system-frontend.md#91-files-deleted)).
- The production navigation label is "Trip log", not the examples' "Trips"
  ([frontend 2.3](admin-design-system-frontend.md#23-navigation-model)).
- The logo links to `/<lang>/<branch>/fleet`, which has no route yet: the wildcard redirects to
  the language root, which opens Vehicles.

### Admin phase per screen (F3)

Per screen, an Apollo-backed container replaces the story host and feeds the existing view and
drawers, with operations, API, routes, Bulgarian catalog, unit specs and a smoke
([frontend 11](admin-design-system-frontend.md#f3-screens-g1g5-in-parallel)). The views and
drawers are `apps/admin/src/app/features/fleet/<feature>/*-view.ts` and `*-drawer.ts`; their story
hosts are in `apps/admin/src/storybook/samples/pages`.

- Put the container under `features/fleet/<feature>/` and feed the same view and drawers through
  a concrete API and generated operations. Application code must not import `src/storybook`
  (ESLint enforces it). Decide with the user whether the stories then use GraphQL fixtures for
  the containers or keep the sample hosts
  ([open decision](admin-design-system-review-fixes.md#2-storybook-sample-hosts-or-graphql-fixtures)).
- Reduce each view's FilterBuilder fields, operators, sortable columns and enum lists to the
  [standard list contract](../discocan/architecture.md#standard-list-contract), or extend the
  backend first. Backend filters are any-of lists, booleans and ranges; there is no `isNoneOf`.
  Use backend enums and derived values (`state.activity` including `ASSET`, `state.fuelStatus`,
  `documentStatus`, `urgency`) instead of client thresholds. Differences in the examples:
  - Vehicles: filters activity, make, odometer, year and created date and sorts by status, last
    report and odometer are unsupported; the backend's fuel type, current driver, has-device and
    open-alert filters are not offered; low fuel is computed as `fuelPct < 12`.
  - Drivers: sorts by status, score, trips and distance and filters by score and trips are
    unsupported; the licence and tachograph-card date filters are unsupported and map only to
    `documentsExpireWithinDays`; the name sort must be by last name (`LAST_NAME`, the examples
    sort by "First Last"); the backend's `licenseCategories` filter is not offered. Documents are
    flagged at 60 days from the data clock; the backend uses `documentsExpireWithinDays` and 30
    days at the business date.
  - Trips: sort by duration and filters by distance, score above and "has events" are
    unsupported; date conditions become half-open `DateTime` ranges.
  - Alerts: sort by status is unsupported; transitions need `expectedStatus`.
  - Maintenance: sorts by task, vehicle and cost and filters by due date and cost are
    unsupported; the task filter must use the `FleetServiceType` enum (`serviceTypes`) instead of
    free-text task names; urgency `OK`/`DONE` differs from `UPCOMING`/`UNKNOWN_ODOMETER` (null unless
    PLANNED); "complete" is only a list action, without the completion form
    `completeFleetServiceTask` needs.
  - Devices: the status, vehicle and last-seen sorts, the online/offline/in-stock status filter
    and the firmware and installed filters are unsupported; the signal and voltage columns and
    Restart have no backend (`FleetDevice.vehicleId` is mandatory). The model filter must use the
    `FleetDeviceModel` enum instead of the examples' free model names. The backend's `options`
    and `vehicleIds` filters are not offered. General settings (units, time zone, thresholds,
    notifications) have no backend either (backend 14). Both need a user decision or must be cut.
  - Overview: the example has one loading/error state and KPIs (distance today, activity by
    group) that differ from B3's per-card queries.
- PrimeNG 22 `p-table` reports an intermediate ascending sort on the first render. The components
  that render `p-table` (the sortable `features/fleet/*/*-view.ts` views) use `injectSortReady()`
  and `[lazyLoadOnInit]="false"` ([table conventions](../admin-design-system.md#table-conventions));
  containers do not need it.
- Turn the example drawers, which use `[closeLink]="null"` with `(closeRequest)`, into child-route
  drawers with `leaveDrawer`, `canLeave()` and `injectDrawerHost`
  ([frontend 4.1](admin-design-system-frontend.md#41-route-tree),
  [route drawers](../admin-design-system.md#route-drawers)). `leaveDrawer`, `drawerRouteData` and
  `drawerParam` are unit-tested but used only by their specs. `injectDrawerHost`
  (`apps/admin/src/app/ui/drawer/drawer-host.ts`) has no spec: unit-test it (`ROUTER_OUTLET_DATA`
  present, absent, malformed) when the first container uses it.
- Define the URL encoding of `ListQuery` (search, conditions, sort, page, page size) per list from
  the operators the backend supports, and reuse or retire `UrlListState`/`ListDefinition`
  ([list URL state](../admin-design-system.md#list-url-state); unit-tested, used only by their
  specs). The example lists keep a `ListQuery` in signals; production lists keep URL-backed
  state. The search applies on every keystroke today: add the debounce and the five-word limit.
- Add `i18n/bg.json` and a parity spec to each of the eight feature catalogs (only `en.json`
  exists) and unit specs for the views and drawers (none exist).
- Routed pages use `holita-page-header` (`#page-title` receives focus after a page change), record
  pages call `injectPageRecord`, and future tab child routes set `data: { tab: true }`.
- Not designed yet: the Driver scorecard page, the MANUAL odometer-reading drawer, the
  service-completion form with the next task and a Login story.

### Account and notifications

`AdminWorkspace` (`apps/admin/src/app/workspace/admin-workspace.html`) passes no `account` or
`notifications` to the shell, so the bell is hidden and the account menu names the tenant.
Neither has a backend design. Frontend spec 0.2 forbids shell badges from business data, so
wiring the bell needs a user decision. Start from the `account` and `notifications` inputs of
`apps/admin/src/app/layout/admin-topbar.ts` and the [Shell](../admin-design-system.md#shell)
section.

### F4 and F5

- F4 Integration: documentation and rules, backlog and retirement check
  ([frontend 11](admin-design-system-frontend.md#f4-integration)).
- F5 Proof and regression: central-change proof and, only on the user's explicit request,
  `test:full` ([frontend 11](admin-design-system-frontend.md#f5-proof-and-regression)).

## Fleet demo scope: remaining

The implemented entities, list contract, two clocks, error model and MANUAL odometer rule are
described in [Discocan architecture](../discocan/architecture.md#standard-list-contract) and the
[Fleet implementation index](../discocan/fleet.md). All tables are holita-owned, Tenant/Branch
scoped with composite foreign keys, and unrelated to the temporary Karma Client.

- Overview: needs-attention queue, KPIs that say "data as of" and window aggregates; every card
  fails and retries on its own (B3).
- Demo data: a deterministic, insert-only demo seed kept apart from the existing Fleet seed (B4).
  The development seed has no drivers, groups, samples, trips, events or service tasks, so a live
  Gateway shows almost no activity until then.
- Screens: Overview, Alerts inbox, Vehicles list and profile, Trips with an event timeline,
  Drivers and scorecard, Maintenance, Devices, Vehicle groups; every editor and workflow is a
  child-route drawer over its list (admin phase).
- Navigation groups: Monitoring (Overview, Alerts, Trip log), Fleet (Vehicles, Drivers, Devices),
  Service (Maintenance), Settings (Vehicle groups).
- Deferred backlog: fuel entries, geozones, diagnostic fault lifecycle, eData readings and
  reporting configuration, driver-assignment history, editable thresholds.

## Open items

- Rotate the PrimeUI license key that an earlier commit stored in `apps/admin/public/config.json`;
  the tracked file no longer holds it (user action).
- `holita-menu-button` and `holita-row-actions` have no dedicated `Design System/Patterns` stories;
  they are covered only indirectly, by the Shell, TablePanel and Examples stories. Add stories
  beside `apps/admin/src/app/ui/menu-button` and `ui/row-actions`.
- Example stories without a play function (Loading, Empty, Error, Mobile, Dark in
  `features/fleet/*/*.stories.ts`) do not wait for `ExampleApp`'s routed page, so axe may check
  only the shell: wait for the page heading.
- The "Filters (n)" toggle below `sm` is not implemented (`activeFilterCount` in
  `ui/list/list-state.ts` is unused): implement it in FilterBuilder or drop it from the design.
- `apps/admin/src/app/theme/contrast.ts` does not check the neutral and accent solids, the dark
  accent tag, the solid buttons' hover and active steps or the topbar unread badge.
- The whole admin unit suite times out the first `admin-workspace.spec.ts` case (5 s) under load
  in WSL, while the file passes alone. Resolve it before `test:full`.
- Cleanup: the unused `--p-app-sidebar-item-muted-color` (`theme/holita-preset.ts`); `.app-num`
  declared both in the preset and in `styles/_patterns.scss`; the `p-multiselect` rule in
  `_patterns.scss` (the control is unused); the `locale` global in the `ui/ui-language.ts`
  comment; the example comments claiming that page state survives sidebar navigation
  (`storybook/samples/example-app.ts`, `examples-tour.stories.ts`, `pages/example-routes.ts`; no
  route reuse strategy exists).
