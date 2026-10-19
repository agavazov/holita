# Admin design system: review fixes

Open fixes from the design-system review, each verified against the code. R2–R4 are the
review's finding numbers; these fixes and the trip in-progress upper bound remain required
before public release after the accepted merge into `main` for internal testing. Line numbers
are approximate: re-check them before editing. Work in the order of the sections below. R2
(smokes for the menu topbar), the agreed decisions and the remaining phases are in
[admin-design-system.md](admin-design-system.md).
When a section is done, remove it and its mention in the "Review fixes" summary of
[admin-design-system.md](admin-design-system.md#review-fixes); when a decision is made, record it
under "Decisions agreed with the user" there and remove it here. When this file is empty, delete
it and its links (`git grep -n "admin-design-system-review-fixes" -- docs .agents` must then print
nothing).

## R3 Serialized MANUAL odometer readings

**Problem.** `recordFleetOdometerReading` (`apps/fleet/src/modules/telemetry/telemetry.resolver.ts:29-34`)
checks the vehicle is not INACTIVE (`telemetry.service.ts:97-99`), the data clock (:100-104) and
the latest reading (:105-111: strictly later, not lower), calls Core `requireBranch` (:112, an
HTTP round trip that widens the window) and inserts (`insertManualReading`,
`telemetry.repository.ts:207-221`) without a transaction or lock; `latestOdometerReading`
(:193-204) reads outside any transaction. The unique index (`schema.prisma:283`; migration
`20261018110000_fleet_activity`:144, without NULLS NOT DISTINCT) never applies to MANUAL rows,
whose `deviceImei` is NULL by CHECK (:207), so even a double submit stores two rows. Example:
latest 1050 km at 05:30Z; 1200 km at 06:10 and 1100 km at 06:20 both pass and the odometer goes
down over time. A deactivation (`vehicles.repository.ts:190-195`) can also land between the
INACTIVE check and the insert. No constraint expresses "monotonic per vehicle", so the fix is a
lock; no migration, SDL or codegen change.

**Fix** (under `apps/fleet/src`)

1. `modules/telemetry/telemetry.repository.ts`:
   - next to `sampleSelect` (:24-45):
     `const odometerSelect = { odometerKm: true, recordedAt: true } satisfies Prisma.VehicleStatusSampleSelect;`
     and `export type OdometerReading = Prisma.VehicleStatusSampleGetPayload<{ select: typeof odometerSelect }>;`
   - move the query of `latestOdometerReading` into a module function
     `latestOdometer(client: Prisma.TransactionClient, scope, vehicleId)` (same scoped `where`,
     `odometerKm: { not: null }`, order `recordedAt` desc then `id` desc); the method passes
     `this.prisma.client` (assignable, as at `edata-catalog/catalog.repository.ts:75`);
   - `insertManualReading(scope, data, check: (latest: OdometerReading | null) => void): Promise<SampleRow | null>`
     runs in `this.prisma.client.$transaction(async (transaction) => …)`: lock the vehicle row,
     return null when no row comes back, call `check(await latestOdometer(transaction, …))`, then
     `transaction.vehicleStatusSample.create` with `source: 'MANUAL'`, `deviceImei: null` and
     `select: sampleSelect`. The lock, parsed with `rowsOf(locked, (row) => text(row, 'id'))`
     (`database/sql.ts` helpers, already imported):

     ```sql
     SELECT v."id"::text AS "id" FROM ${fleetTable(this.prisma.schema, 'Vehicle')} v
     WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
       AND v."id" = ${data.vehicleId}::uuid AND v."status"::text <> 'INACTIVE'
     FOR NO KEY UPDATE
     ```

   - Keep the default READ COMMITTED (pass no `isolationLevel`, unlike the list repositories): the
     read after the lock must see a reading committed while waiting; RepeatableRead takes its
     snapshot at the lock statement and keeps the race. Say so in the JSDoc.
   - `FOR NO KEY UPDATE` conflicts with itself and with the vehicle's UPDATE or DELETE
     (deactivation) but not with the foreign-key KEY SHARE locks of inserts elsewhere; `FOR UPDATE`
     is also correct, only stronger. Fallback if raw row locks are rejected:
     `pg_advisory_xact_lock(hashtextextended('fleet-odometer:<tenant>:<branch>:<vehicle>', 0))`
     (`catalog.repository.ts:82-84`), which does not cover deactivation.
2. `modules/telemetry/telemetry.service.ts`: a `VEHICLE_REQUIRED` constant for the :99 message; a
   module function `requireAfterLatest(latest, reading)` holding the one copy of the rule (the
   block form of :106-111, for narrowing); in `recordOdometerReading` replace :105-120 with the
   early `requireAfterLatest(await this.telemetry.latestOdometerReading(scope, vehicleId), reading)`
   (an invalid reading still makes no Core request: `test/telemetry.db.spec.ts:254`,
   `telemetry.service.spec.ts:174`), then `requireBranch` outside the transaction (never hold a
   row lock across a Core call), then
   `insertManualReading(scope, reading, (latest) => requireAfterLatest(latest, reading))`, and
   `invalid('vehicleId', VEHICLE_REQUIRED)` on null. A throw inside `$transaction` rolls back and
   is rethrown unchanged. JSDoc (:85-88): readings of one vehicle are checked and stored one at a
   time; an overtaken reading gets the same BAD_USER_INPUT as if it were sent later.
3. `database/sql.ts:3`: add the vehicle row lock of MANUAL odometer readings to the raw-query
   list.

The `check` callback keeps the rule in the service and returns the sequential field errors; the
rejected alternative (an optimistic compare answered with CONFLICT) adds new error semantics.

**Tests**

- `apps/fleet/test/telemetry.db.spec.ts` (guarded per-run schema; mocked `requireBranch` with
  `mockClear` in `beforeEach`; clock asOf 06:30Z; `record` mutation at :134-135), after :233-255:
  'stores only one of two concurrent readings that both pass the early check' on a fresh vehicle
  ('CB 2026 KM', no readings; the series at :257-294 stays intact). Barrier: both
  `requireBranch` calls wait until the second arrives
  (`requireBranch.mockImplementationOnce(meet).mockImplementationOnce(meet)`; Once, because
  `mockClear` keeps implementations). Send 1200 km at −20 min and 1100 km at −10 min with
  `Promise.all`; exactly one body contains `"source":"MANUAL"` and one `"code":"BAD_USER_INPUT"`
  (either commit order rejects the other on `odometerKm` or `recordedAt`), `requireBranch` ran
  twice, and the vehicle has one sample. Run it first on the unfixed code: it must fail with two
  rows. It catches the old bug deterministically, but a future lock-less re-check only by chance.
  Optional: a `requireBranch` implementation that deactivates the vehicle gives BAD_USER_INPUT on
  `vehicleId` and stores nothing.
- `telemetry.service.spec.ts`: :115 expects the third argument `expect.any(Function)`; new case
  'repeats the latest-reading check under the vehicle lock': a `check` fed 1600 km at 20:45Z
  rejects 1500 km at 21:00Z on `odometerKm`, one fed 1000 km at the data clock rejects on
  `recordedAt`, a null insert result rejects on `vehicleId`, and `requireBranch` ran three times.
  The cases at :145-175 stay unchanged.

**Checks** (DB pool `max: 5`, `database/client.ts:10`, is enough)

```bash
git status --short
npm run db:up          # provision only what is missing; never reset databases or remove volumes
npm run db:setup
npm run db:test:setup
npm run test:fleet:db -- telemetry.db.spec.ts --testNamePattern="concurrent"   # before the fix: fails
npm run test:fleet -- telemetry.service.spec.ts --skip-nx-cache
npm run test:fleet:db -- telemetry.db.spec.ts
npm run test:fleet:db -- constraints.db.spec.ts telemetry.db.spec.ts vehicles.db.spec.ts devices.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts   # records a reading through Router
npx nx run fleet:lint --skip-nx-cache
npx nx run fleet:typecheck --skip-nx-cache
npx prettier --check apps/fleet/src/modules/telemetry apps/fleet/src/database/sql.ts apps/fleet/test/telemetry.db.spec.ts docs/discocan
```

**Docs to update**

- `docs/discocan/fleet.md:74-77` (MANUAL odometer rule): readings of one vehicle are checked
  again and stored one at a time under a lock on the scoped vehicle row; concurrent readings end
  as if sent in sequence (the overtaken one gets BAD_USER_INPUT on `recordedAt` or `odometerKm`);
  the vehicle cannot turn INACTIVE in between.
- `docs/discocan/architecture.md:179-185` and `docs/discocan/instructions.md:24` (raw SQL list):
  the `FOR NO KEY UPDATE` vehicle row lock of a MANUAL reading in a READ COMMITTED transaction.
- `docs/discocan/testing.md:89` (unit: the check repeats under the lock; a missing or INACTIVE
  vehicle under the lock maps to `vehicleId`) and :101-104 (the concurrency DB case).
- Leave the plan in [backend spec](admin-design-system-backend.md) 9.6 unchanged.

## R4 Serialized driver deactivation and vehicle assignment

**Problem.** Driver deactivation (`apps/fleet/src/modules/drivers/drivers.service.ts:332-339`:
`find` with the vehicles include, reject INACTIVE only when `stored.vehicles.length`, then a
separate `DriversRepository.update`, `drivers.repository.ts:160-166`) and vehicle assignment
(`vehicles.service.ts:199` and :223-231 → `checkRelations` :314-317 reads `findDriver`,
`vehicles.repository.ts:141-146`; writes at :175-180 and :182-188) run without a transaction or
lock. The database has only the composite FK (migration `20261018100000_fleet_master_data`:131)
and `Vehicle_inactive_driver_check` (:139, INACTIVE vehicles only); the FK check takes KEY SHARE
on the driver row, which does not conflict with the driver UPDATE's NO KEY UPDATE. A concurrent
deactivation and assignment therefore both commit, leaving an INACTIVE driver on an ACTIVE or
IN_WORKSHOP vehicle. Only the vehicles module writes `currentDriverId`.

**Fix** (under `apps/fleet/src/modules`)

1. `drivers/drivers.repository.ts`: value imports of `Prisma` and `FleetDriverStatus`;
   `fleetTable`, `oneOf`, `rowsOf` from `database/sql.js`;
   `const DRIVER_STATUSES = Object.values(FleetDriverStatus);` (as `telemetry.repository.ts:16-21`).
   Export a plain function (like `importCatalog(client, …)`; no DI wiring):

   ```ts
   export async function lockDriverStatus(
     transaction: Prisma.TransactionClient,
     schema: string,
     scope: FleetScope,
     id: string,
   ): Promise<FleetDriverStatus | null>;
   ```

   It runs `SELECT "status"::text AS "status" FROM ${fleetTable(schema, 'Driver')} WHERE` the
   scoped tenant, branch and id `FOR NO KEY UPDATE` and returns
   `rowsOf(rows, (row) => oneOf(row, 'status', DRIVER_STATUSES))[0] ?? null`. Its JSDoc says
   that deactivation and every vehicle write that sets a driver take it first, and that NO KEY
   UPDATE does not block foreign-key KEY SHARE locks. `update` returns `DriverRow | null` and runs
   in `$transaction(…, { isolationLevel: 'ReadCommitted' })`: for `status: 'INACTIVE'` it locks,
   counts the scoped vehicles with `currentDriverId: id` and returns null when any exist, then
   calls `transaction.driver.update` (P2025 still maps to NOT_FOUND).

2. `drivers/drivers.service.ts`: an `ASSIGNED_DRIVER` `FieldError` (path `status`, message
   'Unassign the driver from its vehicles first.') beside :75-82; the pre-check (:334-335) and a
   null result after the try/catch (:337-343) both call `invalidFields([ASSIGNED_DRIVER])`; drop
   the `invalid` import if unused.
3. `vehicles/vehicles.repository.ts`: `create` and `update` return `VehicleRow | null` and run in
   a ReadCommitted transaction; with a non-null `currentDriverId` they call `lockDriverStatus` and
   return null when it is null or INACTIVE. `findDriver` stays for the pre-check; P2025, P2002 and
   P2003 still reach `writeError`.
4. `vehicles/vehicles.service.ts`: an `UNAVAILABLE_DRIVER` `FieldError` (path `currentDriverId`,
   message 'Choose an active driver in this branch.') beside :65-69, used in `checkRelations`
   (:316-317) and on a null result in `create` (:202-208) and `update` (:233-239). The order stays
   `checkRelations` → `checkDuplicates` → `core.requireBranch` (outside the transaction) → locked
   write.

READ COMMITTED must be explicit: under RepeatableRead or Serializable the snapshot predates the
lock wait. No deadlock: every path locks at most one Driver row and before any Vehicle row. With
Prisma's interactive-transaction defaults (maxWait 2 s, timeout 5 s, pool 5), a request waiting
over 5 s fails as INTERNAL; accepted, real holds last milliseconds. Every driver update and
vehicle write now costs a BEGIN/COMMIT. `FOR UPDATE` would also be correct but blocks foreign-key
inserts referencing the driver. No schema, migration, SDL, resolver or admin change.

**Tests**

- New helper `apps/fleet/test/driver-row-lock.ts` (not a spec; DB `testMatch` is
  `test/**/*.db.spec.ts`): `afterLockedDriverChange(database, driverId, change, requests)` runs in
  `database.client.$transaction(…, { timeout: 15000 })`: lock the driver row with
  `SELECT pg_backend_pid() AS "pid" … FOR UPDATE` (parsed with `rowsOf`/`integer`, throw if
  missing), `await change(transaction)`, start `requests()`, poll through `database.client`
  (`SELECT count(*)::int AS "waiting" FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids("pid"))`,
  every 20 ms via `node:timers/promises`, about 250 tries, else throw a fixed message) until all
  requests wait, then commit and return the responses. The holder uses FOR UPDATE so the unfixed
  FK check waits too and the test fails on an assertion, not a timeout. Connections: 4 of 5.
- `apps/fleet/test/drivers.db.spec.ts`, after 'protects assigned drivers…' (:204-246): change =
  create vehicle 'CB 3003 AX' with driver D; request = deactivate D → BAD_USER_INPUT with
  `fieldErrors: [{ path: 'status', message: 'Unassign the driver from its vehicles first.' }]`, D
  still ACTIVE, one vehicle on D.
- `apps/fleet/test/vehicles.db.spec.ts`, after the relations case (:285-355): change = D INACTIVE;
  requests = create 'CB 4004 AX' with D and update an unassigned vehicle V to D → both
  BAD_USER_INPUT on `currentDriverId` ('Choose an active driver in this branch.'); no vehicle on
  D, one vehicle in the branch, D INACTIVE.
- Write both DB cases first; on the unfixed code both fail on assertions, and so does a re-check
  without the lock.
- Unit: `drivers.service.spec.ts` (near :367-402) maps a null `update` to the `status` error;
  `vehicles.service.spec.ts` new 'maps a driver deactivated before the locked write to
  currentDriverId' for create and update; the cases at :252-287, :309-331 and :367-391 stay.
- Optional: an end-to-end race of both real mutations behind a no-op change, exactly one wins
  (`events.db.spec.ts:415-427` style).

**Checks**

```bash
git status --short
npm run test:fleet -- drivers.service.spec.ts vehicles.service.spec.ts --skip-nx-cache
npm run db:up          # provision only what is missing
npm run db:setup
npm run db:test:setup
npm run test:fleet:db -- drivers.db.spec.ts vehicles.db.spec.ts   # before the fix: new cases fail
npm run test:fleet:db -- drivers.db.spec.ts vehicles.db.spec.ts   # after the fix: all green
npm run test:fleet:db -- constraints.db.spec.ts
npm run lint
npm run typecheck
npm run format:check
git ls-files --others --exclude-standard   # includes the new test helper
```

No codegen, `schema:check`, `test:schema` or `test:gateway:db`: no SDL or migration changes.

**Docs to update**

- `docs/discocan/fleet.md` [master data rules](../discocan/fleet.md#master-data-rules): Vehicle
  bullet (:103-110) "A vehicle write that sets a current driver locks that driver's row and
  re-checks it in the same transaction, so it cannot interleave with the driver's deactivation.";
  Driver bullet (:118-124) "the change locks the driver row and re-counts its vehicles in the same
  transaction, so a concurrent assignment and deactivation cannot both succeed (the later one
  fails with the field error)".
- `docs/discocan/architecture.md`: the raw SQL list (:179-185) gains `lockDriverStatus`
  (`SELECT … FOR NO KEY UPDATE`); the constraint (:46-54) or error paragraph (:200-205) says the
  Vehicle/Driver rules have no constraint, both writes lock the driver row in a READ COMMITTED
  transaction and re-check, and the pre-check only gives the early field error.
- `docs/discocan/testing.md` Vehicles (:17-23) and Drivers (:66-74): the unit and DB cases; the
  `test/driver-row-lock.ts` gate (`pg_blocking_pids`) described once. `docs/testing.md` stays.

Follow-ups, ask first: on one vehicle, `updateFleetVehicle(status: INACTIVE)` racing an update of
`currentDriverId` hits `Vehicle_inactive_driver_check`, which `writeError` does not map (INTERNAL);
service-task creation checks "vehicle not INACTIVE" without a lock and can race deactivation.

## Trip in-progress upper bound

**Problem.** `tripInProgress` (`apps/fleet/src/modules/trips/trips.service.ts:47-57`) has no upper
bound: an open trip starting after `asOf` (07:00Z with asOf 06:30Z, or next year) is
`inProgress: true`. The SDL (`trips.graphql:30`, "within 24 h before the Branch data clock") and
`docs/discocan/fleet.md:70` promise the bound, and windows are `(start, end]` ending at `asOf`
(`clock/fleet-clock.ts` `DataWindow`; `trips.repository.ts:141`, `:184`). It is used by `toTrip`
(:87) with one `telemetry.asOf(scope)` per page (:159-166); no SQL computes it and no seed writes
trips.

**Fix.** Add `trip.startedAt.getTime() <= asOf.getTime()` to the expression, making both bounds
inclusive (`[asOf − 24 h, asOf]`); JSDoc "No end and started in the `OPEN_TRIP_MAX_HOURS` up to and
including the data clock."; `apps/fleet/src/fleet-thresholds.ts:25` comment "A trip without end
that started in the 24 h up to and including `asOf` ⇒ `inProgress`." The SDL text already matches,
so no codegen or `schema:check`.

**Tests.** `trips.service.spec.ts:36-42`, renamed 'marks open trips in progress only from 24 h
before up to the data clock': a start at `asOf` is true and one 1 ms after it is false. Optional:
in 'accepts a one-millisecond started range…' (:185-208), a found trip starting at `asOf` + 1 ms
maps to `inProgress: false`. Add no trip to `trips.db.spec.ts`: it would change every page, total
and sort assertion (:195-239); :257-262 is the persistence regression.

**Checks**

```bash
npm run test:fleet -- trips.service.spec.ts --skip-nx-cache
npx nx run fleet:lint --output-style=static
npx nx run fleet:typecheck --output-style=static
npx prettier --check apps/fleet/src/modules/trips/trips.service.ts apps/fleet/src/modules/trips/trips.service.spec.ts apps/fleet/src/fleet-thresholds.ts docs/discocan/fleet.md docs/discocan/testing.md docs/todo/admin-design-system-backend.md
# optional, with PostgreSQL: npm run db:up, npm run db:setup, npm run db:test:setup, then
npm run test:fleet:db -- trips.db.spec.ts
```

**Docs to update.** `docs/discocan/fleet.md:70`: "no end and `startedAt` in `[asOf − 24 h,
asOf]`" (keep "(`false` without a data clock)"); `docs/discocan/testing.md:90-91`: `inProgress` at
24 h, 24 h + 1 ms, at the data clock, 1 ms after it, an ended trip and no data clock; the
[backend spec](admin-design-system-backend.md) formula (:1898, add `≤ asOf`) and case list
(:2437).

## Decisions needed from the user

The [internal-testing scope and stabilization requirements](admin-design-system.md#decisions-agreed-with-the-user)
are agreed. The choices below remain open; new screen integration comes last.

### 2. Storybook sample hosts or GraphQL fixtures

Facts: the example pages use `src/storybook/samples/fleet-samples.ts` (fixed `sampleNow` :4;
groups g1–g4; 22 drivers, 46 vehicles, 64 trips, 38 alerts and 30 service tasks; devices
:493-524). The shell's GraphQL handler is `AdminBranches` (`session-fixtures.ts`); the standalone
Login stories also register `AdminTenants` and `AdminDemoLogin` in `storybook/login-fixtures.ts`. Nothing exists
under `src/storybook/fleet/`. Example lists keep a `ListQuery` in signals; `UrlListState` and
`ListDefinition` are unit-tested but unused ([list URL state](../admin-design-system.md#list-url-state)).
Application code must not import `src/storybook`. The open point is recorded under
[admin phase per screen](admin-design-system.md#admin-phase-per-screen-f3). Options: sample hosts
only; GraphQL fixtures for every page (the frontend spec's dataset, store and coverage specs);
sample hosts for the views plus GraphQL-fixture stories for the containers. Where the
ListQuery/URL/GraphQL mapping lives: in each container, in a shared Fleet helper, or in
`UrlListState`.

Recommended: keep the sample hosts for the views and give the Apollo containers their own
GraphQL-fixture stories; each container maps `ListQuery` to its query variables, and
`UrlListState` is adapted to `ListQuery`. Of the frontend spec's 7.3 items this keeps the
per-feature handlers for the containers' operations and `fixture-coverage.spec.ts` (every
operation has a handler); the handlers build their answers from `samples/fleet-samples.ts`. It
drops the shared demo dataset that restates the backend catalog, the store, the derived values,
`demo-dataset.spec.ts`, `derived.spec.ts` and the F4 dataset re-sync. Then apply the
[frontend spec](admin-design-system-frontend.md) consistently with that split as the chosen
plan, replacing the conditional fixture items.

### 3. Remaining device model and installation design

The prototype deliberately includes uninstalled devices, a free model list, diagnostics and
Restart, while the current API requires a vehicle and has a nullable `FleetDeviceModel` enum.
These demo capabilities stay visible with a Demo label; backend support is separate work.
Before real integration, settle the model/installation editor: accept all existing API enum
values and nulls alongside the approved prototype capabilities, without coercing a stored value.
The Vehicles, Drivers, Trips and Maintenance views already cover their added contract states;
this does not resolve the device product model.

### 4. Service-task rules: INACTIVE vehicles and completion odometers

Facts (`apps/fleet/src/modules/service-tasks/`):

- Only create checks INACTIVE (`service-tasks.service.ts:169`, `requireServiceableVehicle`
  :334-338); update, complete, cancel and delete do not, and completion skips
  `core.requireBranch`. Completing with `nextDueOn` or `nextDueOdometerKm` inserts a PLANNED task
  for the INACTIVE vehicle (`service-tasks.repository.ts:268-291`); deactivation leaves PLANNED
  tasks PLANNED. Such tasks are listed with urgency and returned as `FleetVehicle.nextService`;
  only `fleetServiceSummary` excludes them. The DB fixture already has INACTIVE vehicle `c` with
  PLANNED t10 (`test/service-tasks.db.spec.ts:70`, :147).
- `highestCompletedOdometer` (repository :224-241) compares only with DONE tasks of the vehicle
  completed on an earlier date (strict `lt`, :236): same-day and later-dated completions, null
  odometers and telemetry are never compared (bound 0–9,999,999 only). A backdated completion can
  create an already OVERDUE next task (`nextDueOn` only has to follow `completedOn`,
  `service-tasks.service.ts:241-243`). The check runs outside the completion transaction
  (`service-tasks.service.ts:259-270` against `:285`), so parallel completions can both pass. DONE
  tasks cannot be updated or deleted (`service-tasks.service.ts:202-203` and `:311`), so a wrong
  completion cannot be corrected. `docs/discocan/fleet.md:92-93` matches the code; no test covers
  same-day, backdated or INACTIVE completion. The Storybook completion form follows these
  current rules; the live admin does not use it yet. Changing the rules remains a backend decision.
- Options, INACTIVE: keep and document; reject only the next task (BAD_USER_INPUT on
  `nextDueOn`/`nextDueOdometerKm` via an inline `findVehicle` check in `complete`, or CONFLICT);
  reject completion and update too. Odometer: keep "earlier date" and document it; include the
  same date (`lte`); full order (a floor from earlier and a ceiling from later completions, message
  'The odometer cannot be above a later completed service of this vehicle.', settling whether the
  same date counts on both sides). With a stricter order one wrong DONE entry can block later
  correct ones. Comparing with telemetry and a per-vehicle lock stay out unless asked.

Recommended: completing a historical task for an INACTIVE vehicle is allowed but schedules no next
task (BAD_USER_INPUT on `nextDueOn`/`nextDueOdometerKm`). For the odometer keep the "earlier date"
rule and document it, or include the same date (`lte`). Full order is not recommended: DONE tasks
cannot be corrected, so one wrong completion would block later correct ones for good.

After the decision: change `service-tasks.service.ts` (and the repository for the odometer
bounds), `service-tasks.service.spec.ts` (the `highestCompletedOdometer` mocks at :35, :116, :139,
:272-276, :346) and `test/service-tasks.db.spec.ts`. That spec shares state in file order: t2
becomes DONE (2026-10-18, 100,000 km) at :447, t7 and t8 go in the last case, t6 stays PLANNED for
the rollback case; vehicle a also has t11 DONE (2026-10-10, 95,000 km) and t12 DONE without an
odometer. Add new completion cases with t1, t3, t4, t9 or t10 after the summary case (:367):
t10 with `nextDueOn` (rejected on `nextDueOn`, still PLANNED) and without (DONE, `next: null`);
t1 on 2026-10-18 at 96,000 km (same day as t2 at 100,000 km); t3 on 2026-10-01 at 200,000 km
(backdated before t11). Expected per odometer option: "earlier date" accepts t1 and t3; "same
date" rejects t1 on `completedOdometerKm` and accepts t3; full order rejects t3 on
`completedOdometerKm`, and t1 too when the same date counts. Checks:
`npm run test:fleet -- service-tasks.service.spec.ts --skip-nx-cache`, `db:up`, `db:setup`,
`db:test:setup`, `npm run test:fleet:db -- service-tasks.db.spec.ts`, fleet lint and typecheck,
Prettier. Docs: `docs/discocan/fleet.md:89-96`, `docs/discocan/testing.md:93-94` and :107-110,
optionally the rule text in the backend spec (:2187-2200).

### 5. Story tests as a PR gate

Facts: PR CI (`.github/workflows/affected.yml`) runs affected unit, DB and Router targets and, for
an affected admin, the Chromium smokes; it does not build Storybook or run `test:storybook:admin`
([GitHub Actions](../testing.md#github-actions)). Story tests run locally and last in `test:full`,
which stops before them while the smokes fail. Under WSL a whole story file can fail with "Failed
to fetch dynamically imported module" and pass on a rerun. The user's decision keeps visual checks
out of CI; story tests are interaction and axe checks, not visual ones. Options: run them for an
affected admin in PR CI; keep them in full regression only.

Recommended: run the story tests in affected-admin PR CI (after the Chromium install; update the
GitHub Actions section of [testing](../testing.md#github-actions); validate with `actionlint`).

### 6. PrimeUI key rotation

Facts: an earlier commit stored a key in `apps/admin/public/config.json`; the tracked file no
longer holds it, but the value stays in Git history ([open items](admin-design-system.md#open-items)).
Build exclusions keep the current developer key out of production outputs; they do not rotate the historical key.

Recommended: rotation is the user's to confirm; then remove the open item and the key risk in
[frontend 12](admin-design-system-frontend.md#12-risks-accepted-trade-offs-and-deferred-items).
