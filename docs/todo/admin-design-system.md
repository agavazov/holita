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

1. Direction: present two or three token and layout variants of a new shell, a Fleet list with
   filters and a drawer editor in Storybook; the user picks one.
2. Design system: one holita preset (`definePreset`) for brand, density and layout tokens; a
   small set of page patterns with measured reuse (page header, list toolbar and filters, state
   messages, form field, drawer editor); a design-system document and an agent skill with the
   central-change procedure.
3. Standard list contract and Fleet demo domain: define the shared GraphQL list conventions,
   extend Fleet SDL, Prisma models, migrations and synthetic seeds, and add fixtures and stories
   for every real state. Stop for visual approval of the new screens.
4. Rollout: replace the current Fleet screens with the approved patterns, update tests,
   smoke specs and the authoritative documentation, and remove superseded presentation rules.
5. Proof: apply one central token or pattern change and show its propagation in the visual
   review; build the next requested module from the skill alone.

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
