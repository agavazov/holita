# Admin design system

Pending work for a centrally controlled admin design that new modules reuse, reviewed in the
[admin Storybook](../development.md#admin-storybook) before it reaches application screens.
Work happens on the `feature/admin-design-system` branch.

## Decisions agreed with the user

- Keep PrimeNG 22 with its styled-mode tokens. The organisation qualifies for the PrimeUI
  Community license; Storybook runs without a key until a license is bought.
- The current admin presentation is not a reference. Design a new, better visual language from
  the actual data flows; Meridian (meridian.primeuipro.dev, a Nuxt/PrimeVue showcase) is visual
  inspiration only, never a source of code or assets.
- Keep light and dark themes and Bulgarian/English. Brand tokens (color, neutrals, density,
  font, shell geometry) are undecided and must stay easy to change centrally.
- Editing uses a drawer.
- Karma Client is temporary; do not redesign or build on it.
- Develop the Discocan Fleet domain into a rich demo and test bed with synthetic data,
  scenarios and new tables where useful. Backend list APIs may change, but must follow one
  standard contract (pagination, sorting, filtering, search) rather than serve one screen.
- The design system is shared by both domains' future admin screens.
- Approved screenshot baselines stay local and ignored; visual checks stay out of CI for now.

## Remaining phases

The build plans are the [frontend spec](admin-design-system-frontend.md) (phases in its
section 11) and the [backend spec](admin-design-system-backend.md) (slices in its section 13).
Backend slices run in parallel with F0–F3; every build, generation, test and server command runs
under the shared-worktree check lock described in both specs.

- B1 Master data and the list contract: standard list contract, Vehicle/Device extensions,
  Drivers and Vehicle groups ([backend 13](admin-design-system-backend.md#b1-master-data-and-the-list-contract)).
- B2 Activity: samples, trips, events and service tasks
  ([backend 13](admin-design-system-backend.md#b2-activity)).
- B3 Overview: KPIs, attention queue and window aggregates
  ([backend 13](admin-design-system-backend.md#b3-overview)).
- B4 Demo seed and documentation completion
  ([backend 13](admin-design-system-backend.md#b4-demo-seed-and-documentation-completion)).
- F0 Spikes: theme, Storybook switching, CSS layers, breakpoints, route reuse, Storybook tests
  and autocomplete/tabs questions ([frontend 11](admin-design-system-frontend.md#f0-spikes)).
- F1 Design system and shell: theme module, global styles, `app/ui` patterns, new shell, login,
  Storybook tooling, PrimeUI key move, design-system document, skill and ADR
  ([frontend 11](admin-design-system-frontend.md#f1-design-system-and-shell)).
- F2 Fleet scaffolding: route tree, keyed outlet, reuse strategy, scoped clients, shared Fleet
  folder, stubs, fixtures and retirement of the old Fleet screens
  ([frontend 11](admin-design-system-frontend.md#f2-fleet-scaffolding)).
- F3 Screens in parallel groups: Vehicles; Drivers and groups; Alerts and trips; Maintenance;
  Overview and devices ([frontend 11](admin-design-system-frontend.md#f3-screens-g1g5-in-parallel)).
- F4 Integration: documentation and rules, backlog, retirement check and dataset re-sync
  ([frontend 11](admin-design-system-frontend.md#f4-integration)).
- F5 Proof and regression: central-change proof and, on request, full regression
  ([frontend 11](admin-design-system-frontend.md#f5-proof-and-regression)).

## Handoff status (2026-10-18)

Work is on `feature/admin-design-system` in the worktree
`/var/workspace/services/holita.worktrees/admin-design-system`; nothing is merged or pushed.

- Done: Storybook tooling and visual review; B1 (master data, standard list contract, drivers,
  vehicle groups); B2 (samples, trips, events, service tasks); F0–F1 (theme with three brands and
  two densities, `app/ui` patterns, new shell, login restyle, design-system stories).
- Last results: Fleet unit 152/152, Fleet db 125/125, B1 schema 5/5, B1 router 20/20; admin
  lint/typecheck/build pass; admin unit 386/386 (design system), 8/8 (Karma canary), 116/116
  (features); Storybook tests 63/63; shell/foundation/tenants smoke 12/13.
- Phase 1 (fixes) is done: repo lint/typecheck/build pass; federation 17/17, router 20/20,
  Karma Client 139/139; shell, Vehicles and Devices smoke pass. The unit-test `matchMedia` stub
  now reports reduced motion, because jsdom never ends PrimeNG's overlay leave animations.
- Open: the whole admin unit suite still times out a few specs under load in WSL (each file
  passes alone, as in the baseline before this work); address it before `test:full`.
- Next: brand and density choice, B3, B4, F2, F3 (G1–G5), F4, F5 and `test:full`.

## Fleet demo scope (proposal, not implemented)

A dispatcher's workspace rather than a CRUD demo. All tables are holita-owned, Tenant/Branch
scoped with composite foreign keys, and unrelated to the temporary Karma Client.

- Entities: extend Vehicle (fleet number, type, make/model/year, VIN, fuel type and tank,
  status ACTIVE/IN_WORKSHOP/INACTIVE, group, current driver) and Device (model, options,
  firmware, SIM); add Driver, VehicleGroup, VehicleStatusSample, Trip, FleetEvent (alerts with
  an OPEN/ACKNOWLEDGED/RESOLVED state machine) and ServiceTask.
- Screens: Overview (needs-attention queue and KPIs), Alerts inbox, Vehicles list and detail,
  Trips with an event timeline, Drivers and scorecard, Maintenance, Devices, Vehicle groups.
  Every editor and workflow is a child-route drawer over its list.
- Navigation groups: Monitoring (Overview, Alerts, Trips), Fleet (Vehicles, Drivers, Devices),
  Service (Maintenance), Settings (Vehicle groups).
- Demo data: a deterministic, insert-only demo seed kept apart from the existing Fleet seed;
  telemetry KPIs use a Branch data clock (latest device-reported time) and say "data as of";
  business dates (document expiry, service due dates) use the current date in Europe/Sofia.
  Operator-entered odometer readings never move the data clock or the vehicle state.
- One standard list contract for every Fleet list: offset pagination with totals, typed sort
  fields with direction, search and typed filters that the repository can express directly.
  Lists do not sort or filter on derived telemetry values unless a scoped query proves totals,
  order and paging.
- Contract slices land together with their resolvers: master data (vehicle/device columns,
  drivers, groups) first, then activity (samples, trips, events, service, overview).
  Duplicates are `BAD_USER_INPUT` field errors; `CONFLICT` is reserved for state-machine
  mismatches and deletions blocked by history.
- Existing Fleet db specs that assert columns or migration history must be updated with each
  migration; Overview cards must be able to fail and retry independently.
- Deferred backlog: fuel entries, geozones, diagnostic fault lifecycle, eData readings and
  reporting configuration, driver-assignment history, editable thresholds.

## Open items

- Decide whether `@storybook/addon-vitest` should run stories (play functions, accessibility)
  in Vitest browser mode.
- Raise Storybook accessibility checks from `todo` to `error` once the new theme passes contrast;
  the current emerald primary with white text is below WCAG AA.
- The tracked `apps/admin/public/config.json` contains a PrimeUI license value; move it to an
  ignored local configuration and rotate it.
