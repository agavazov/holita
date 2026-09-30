# Aurora layout migration: working plan and source inventory

This is a requested planning artifact, not documentation of implemented product behavior.
Phase 1 covers the reference, source/dependency inventory, cleanup conditions and agent
guidance. Application integration starts in phase 2. Module redesign requires separate
user acceptance of the completed shell with the existing CRUD still working.

## Current checkpoint

Phases 1–4 are complete. The user accepted proceeding with the shell, deferred cosmetic
comments, selected concrete Aurora CRUD references and explicitly authorized Products
implementation. Products is implemented and visually accepted. Module migration step 1
is complete: Venues is implemented and verified. Module step 2 (Speakers/Tags) is
implemented and verified. Module step 3 (Events list/editor/overview) is implemented and
verified. Module step 4 (Sessions, speaker summaries, Gallery and History) is implemented and
verified. Module step 5 (remaining store states and Ant Design removal) is implemented and
verified. All planned module migration and legacy-dependency cleanup steps are complete.
The subsequent code review fixes and verification are recorded below. These module steps
are separate from the original shell phases 1–4; the deferred cosmetic review remains separate.

Preparatory step 0 is complete: the Products sorting DB fixture uses an explicitly typed
three-item tuple, its focused PostgreSQL case passes, and root lint/typecheck/build pass.
Typecheck and build were executed without Nx cache. No module migration is included in
this preparatory step. Its results remain separate from the Venues work below.

- [AdminLayout](../../apps/admin/src/layout/admin-layout.tsx) uses the original Aurora
  Sidenav / Stacked presentation and local search/language/theme/notification/profile menus.
  Store and navigation inputs remain plain props; layout has no Refine, GraphQL or router imports.
- [StoreWorkspace](../../apps/admin/src/features/stores/store-workspace.tsx) retains store
  discovery, URL navigation, Reference availability, loading/error/empty states and the
  keyed feature subtrees. Product and Reference editors retain their existing lifecycle.
- Required shell dependencies are installed at the reference versions. Existing React,
  React Router and Refine versions remain unchanged. Ant Design has been removed. Icons, font and avatars
  are local; unrelated Aurora demo packages and providers are excluded.
- The old header/sidebar CSS has been replaced. Products, Venues, Speakers, Tags and the
  Events list/editor/overview and child workflows use Aurora/MUI. Store discovery/unavailable
  states also follow the selected Aurora preset.
- Temporary example avatars are grouped under `apps/admin/public/images/tmp/avatar`; local demo
  data references `/images/tmp/avatar/` so the shell still serves them in development and builds.
- Phase 3 baseline: root lint/typecheck/build passed, with 13 selected component and 13 browser cases.
  Search focus/labels and the default primary-color checkmark were corrected during review.
  The shared Emotion CSSOM cache resolved slow Ant Design head scans without test mocks,
  timeout changes or removed assertions. Original and integrated shell captures were reviewed
  at matching sizes, including menus, hover, mobile drawer and dark mode.
- The phase 3 lockfile added 42 package entries, with no existing package version changes or removals.
  Build still reports a large main chunk: about 2.78 MB minified / 834 KB gzip. Both UI
  libraries remain while legacy CRUD is present; the warning is not suppressed.
- Phase 4 verified 8 store workspace component cases and 15 distinct browser cases.
  Search positioning/focus and notification action focus were corrected without dependencies.
- The user accepted the Products appearance and requested the same search field in the
  advanced filter panel. Quick and panel search now share one value; Clear filters resets
  search, status and SKU together. Venues now reuses the same shared presentation components.
- The user subsequently authorized Products sorting. Name, SKU and Status now use server
  sorting with URL state and the existing Aurora header indicators. The default stays
  newest first; changing sorting resets the page/selection while preserving filters.

## Post-migration code review

The user authorized a review of the migrated CRUD, cleanup and fixes. The review covered
list/query state, deletion, forms and time conversion, store/route mutation boundaries,
Event child workflows, the additive filter/sort provider and backend changes, imported
production files, dependencies and reuse guidance.

- Reproduced two bugs with failing regression cases before fixing them: minute-precision
  Event/Session inputs silently truncated stored seconds/milliseconds, and browser Back
  could let pending search overwrite the restored filters when their search parameter was
  unchanged. Native time inputs now preserve exact untouched instants. Products, LookupList
  and Events restore text drafts on every navigation.
- Products and LookupList now share `useRecordDeletion`. It retains sequential captured-store
  requests, the synchronous duplicate-submit guard, partial failures, failed-only retry and
  stopping unsent requests on unmount. Concrete lists own their selection/page adjustments,
  confirmation text and notices. Event atomic lifecycle actions remain separate.
- Removed the obsolete Dayjs-picker conversion path; native Event/Session inputs have one
  conversion boundary. The refactored production files plus the new deletion hook contain
  36 fewer lines than the review baseline, with regression coverage added separately.
- ReferenceWorkspace lazy-loads EventEditor/Tiptap using native React lazy/Suspense, within
  the existing keyed route boundary. Initial JS changed from 2,225.91 kB / 654.81 kB gzip to
  1,817.45 kB / 527.13 kB gzip (19.5% less compressed initial JS). EventEditor is a separate
  406.03 kB / 128.30 kB gzip chunk; this defers its download rather than removing its features.
  The large-main-chunk warning remains. No dependency or API/schema/database change was needed.
- Updated the authoritative CRUD reference, testing guide and admin skill; corrected a stale
  Ant Design statement in this plan. A local import-graph check reached all 157 production
  TS/TSX/CSS files from main.tsx, including dynamic imports. No orphan file or Ant Design
  reference was found in admin source/package manifests/lockfile. The admin dependency tree
  is valid and the edited documentation links resolve.

Validation:

- `npm run test:admin -- event-time.test.ts event-form-state.test.ts session-workspace.test.tsx --output-style=stream`:
  **15 passed**.
- `npm run test:admin -- product-list.test.tsx venue-list.test.tsx event-list.test.tsx store-workspace.test.tsx reference-workspace.test.tsx --output-style=stream`:
  **35 passed**, including partial failure/retry and pending mutations during store/route changes.
- `npm exec -- eslint apps/admin/src`: passed. The smoke prerequisite executed admin
  `tsc --noEmit --project tsconfig.json && vite build`: passed. Backend builds were cached;
  their application processes and dedicated database schemas are fresh in each browser fixture.
- Prettier on edited files and `git -c core.safecrlf=false diff --check`: passed.
- `npm run test:smoke -- products.smoke.spec.mts products-aurora.smoke.spec.mts venues-aurora.smoke.spec.mts lookups-aurora.smoke.spec.mts events.smoke.spec.mts rich-text.smoke.spec.mts sessions.smoke.spec.mts --grep='Aurora Products (sorts|applies|synchronizes)|Aurora Venues (sorts|shares)|Aurora (Speaker|Tag) list|Event (create/edit|filters)|pending Event|rich text|Sessions persist|pending mutation|delayed product|history navigation' --output-style=stream`:
  **16 passed**, using the real gateway and fresh dedicated test schemas. No `test:full` was run.
- Inspected generated desktop/mobile lookup and Event editor captures. Deleted the ten
  temporary captures created under `artifacts/aurora/lookups` and `artifacts/aurora/venues`;
  normal ignored Playwright output remains under `test-results/browser`. No screenshot is
  a runtime input or newly tracked file.
- The development admin and all four backend health endpoints return HTTP 200. A read-only
  gateway query returns both existing stores without errors. The browser fixture closed its
  owned processes; the pre-existing development group stays available for the user.

## Products CRUD stabilization review

The user requested cleanup and accurate reuse guidance before applying the pattern to other
modules. Review covered the list, filters, row actions, form/editor, shared header/pagination,
grid theme, Refine/provider lifecycle and the Products backend contract.

- Consolidated repeated filter/sort URL writes into the local `changeListQuery` function.
  It merges text drafts, resets pagination and cancels the debounce in one place. Retained
  the small draft/URL synchronization guard because clearing filters must not schedule a search.
- Removed copied Aurora styling/configuration for unused built-in grid filter, column-menu
  and column-management panels. Moved the existing keyboard focus ring into the grid theme.
- Removed redundant grid props and the form key already covered by the workspace's pathname
  boundary. The four production files contain 156 fewer lines than the review baseline.
- Browser reload coverage exposed a page reset while the initial total was still unknown.
  The grid now uses its native unknown count until the first successful response, and the
  pagination component honors the native disabled state instead of displaying a false zero.
  Server filter mode remains explicit. The controlled sort model now keeps its identity until
  the sort changes; otherwise MUI emits a sort event on data refresh and resets the page.
  A delayed-first-response component case reproduces that deferred reset and protects the fix.
- Removed loading-based row eligibility. A cached filter result could otherwise populate
  the grid while fetching and leave the header checkbox out of sync with selected rows.
  Selection still resets with its query scope and is blocked during deletion.
- Retained store/route isolation, synchronous submission guards, scoped cache invalidation,
  literal/Unicode validation, deterministic server pagination and partial-delete reporting.
  These protect implemented contracts; the backend review did not justify another refactor.
- Expanded the existing [reference index](../../docs/reference.md#products-the-aurora-crud-reference)
  with component ownership, current behavior/limitations and focused checks. Updated the
  architecture, usage and agent guides to make Products the Aurora presentation reference
  while retaining Reference's domain-specific behavior. No generic CRUD controller, new
  dependency, API change or migration was introduced.

### Stabilization validation

Executed from the repository root:

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:admin -- product-list.test.tsx product-form.test.tsx data-provider.test.ts store-workspace.test.tsx --skip-nx-cache
npm run test:admin -- product-list.test.tsx --skip-nx-cache
npm run test:admin -- product-list.test.tsx store-workspace.test.tsx --skip-nx-cache
npm run test:admin -- store-workspace.test.tsx --testNamePattern='requires delete confirmation' --skip-nx-cache
npm run test:smoke -- products-aurora.smoke.spec.mts products.smoke.spec.mts
npm run test:smoke -- products-aurora.smoke.spec.mts --grep='sorts across|applies server filters'
npm run test:smoke -- products-aurora.smoke.spec.mts --grep='applies server filters'
npm run typecheck:tools
npm exec -- eslint apps/admin/src/features/products/product-list.tsx apps/admin/src/features/products/product-list.test.tsx apps/admin/src/features/products/product-editor.tsx apps/admin/src/theme/components/DataGrid.tsx apps/admin/src/components/data-grid-pagination.tsx tools/browser/products-aurora.smoke.spec.mts
npm exec -- eslint apps/admin/src/features/stores/store-workspace.test.tsx
git diff --check
```

- **31 distinct admin cases passed.** The four-file selection passed 31/31. After the
  pagination and selection fixes, the list/workspace selection passed 11/12; the remaining
  case timed out waiting for the initial store/list render. It now awaits the actual grid
  and product data before opening the row menu. Its isolated run passed 1/1, with nine
  deliberately unselected cases. Test assertions and timeouts were not weakened.
- **8 distinct browser cases passed across focused runs.** The combined selection passed
  7/8 and exposed the page-reset defect. After stabilizing the sort model, the sorting case
  passed again and the filter/delete case reached the stale header-checkbox defect.
  Removing loading-based eligibility made that full case pass, including reload, filters,
  page-local selection, confirmation and batch deletion. Repeat executions are not extra cases.
- The delayed-response list case failed with the old changing sort-model identity and
  passed after the fix. It lets deferred grid updates settle before asserting the URL.
- Focused ESLint covered product-list, product-list tests, product-editor, DataGrid theme,
  pagination, the Aurora browser spec and the changed store-workspace test. Tools TypeScript
  passed. Smoke prerequisites executed admin TypeScript and Vite build successfully;
  backend generation/build cache hits are not counted as new backend runtime evidence.
  Early test/total typing errors were corrected before the successful build.
- Visual review retained the desktop/mobile form and table composition. Seven integrated
  captures were byte-identical to the review baseline; the refreshed dark capture was
  inspected, and image hashes/dimensions matched the capture metadata at review time.
  The temporary captures and metadata were subsequently deleted at the user's request.
  The existing large-bundle warning remains (about 993 KB gzip).
- Relative links in the nine changed guides/documents and `git diff --check` passed.
  A read-only live-browser check verified Products and sorting without JavaScript errors.
  Admin, gateway, core, products and reference health checks returned HTTP 200. Browser
  fixtures closed their dedicated processes/schemas; development data was not a test fixture.

Products is the stabilized reference used by the Venues migration below. Preserve each
module's existing domain contracts and use the shared presentation components identified
in the reference index.

## Module migration step 1: Venues

- Replaced Venue list/editor/form Ant Design markup with Aurora/MUI. The list uses the
  accepted header, DataGrid, checkboxes, row menu, shared quick/panel name search and
  immediate Active/Inactive filtering. URL state includes server sorting and pagination.
- Added additive Venue sort inputs and provider/repository mapping for Name, City, Country,
  Capacity and Status. Sorting runs before pagination; ID descending breaks ties, and null
  capacity stays last in both directions. No Prisma migration is needed.
- Preserved required/optional field validation, server field-error focus, local drafts,
  dirty navigation, store/route isolation and existing referenced-venue deletion refusal.
  Sequential batch deletion reports partial failures and retries only failed records.
- Reused three focused presentation components between Products and Venues:
  [FilterDrawer](../../apps/admin/src/components/filter-drawer.tsx),
  [RecordActions](../../apps/admin/src/components/record-actions.tsx) and
  [EditorAside](../../apps/admin/src/components/editor-aside.tsx).
  Feature data access and state stay in their modules; there is no generic CRUD controller.
- Migrated the shared Reference success notice and dirty-form dialog to MUI, retaining
  their existing lifecycle. Existing Event/Speaker/Tag callers continue to use them.
- Removed the replaced Venue presentation and old ProductActions location. LookupList,
  legacy field-error helpers/CSS and Ant Design remain because other modules still use them.
  No new package dependency was introduced.
- Updated the reference index, architecture, development, requirements, README and testing
  guides to describe the implementation and its focused checks.

### Venue validation

Executed from the repository root:

```bash
npm run codegen
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:reference -- venues.service.spec.ts
npm run test:reference:db -- venues.db.spec.ts
npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:gateway:db -- federation.db.spec.mts --testNamePattern="sorts Venue pages|federates Venue.store"
npm run test:admin -- venue-form.test.tsx venue-list.test.tsx reference-workspace.test.tsx data-provider.test.ts product-form.test.tsx product-list.test.tsx event-workspace.test.tsx
npm run test:admin -- venue-list.test.tsx event-workspace.test.tsx
npm run test:admin -- event-workspace.test.tsx store-workspace.test.tsx
npm run test:admin -- store-workspace.test.tsx --testNamePattern="reports partial batch deletion"
npm run test:smoke -- venues-aurora.smoke.spec.mts reference.smoke.spec.mts reference-layout.smoke.spec.mts reference-disabled.smoke.spec.mts products.smoke.spec.mts products-aurora.smoke.spec.mts
npm run test:smoke -- products-aurora.smoke.spec.mts reference.smoke.spec.mts reference-disabled.smoke.spec.mts --grep='Aurora Products sorts|Aurora Products applies server filters|Venue CRUD works|disabled Reference' --output-style=stream
npm run test:smoke -- reference.smoke.spec.mts reference-disabled.smoke.spec.mts venues-aurora.smoke.spec.mts --grep='Venue CRUD works|disabled Reference blocks|Products creation and mobile|shares quick and panel filters|editor keeps' --output-style=stream
npm run test:smoke -- reference-disabled.smoke.spec.mts --grep='blocks .* routes' --output-style=stream
npm run typecheck
npm run lint
npm run typecheck:tools
npm run build
git diff --check
```

- Venue service **6**, real Venue DB **7**, schema contracts **3** and selected real gateway
  federation **2** cases passed; the federation command deliberately left 19 cases unselected.
- The selected admin files have **49 distinct passed cases across focused runs**. The tests
  exposed and corrected the Inactive tab value and waits for the grid/dialog transition.
  Initial-render timeouts in the shared workspace checks passed on focused reruns. No
  assertions or timeouts were relaxed, and repeat executions are not additional cases.
- The first browser selection passed **13/17**, including all three new Aurora Venue cases.
  Two long Products cases subsequently passed unchanged. The disabled-Reference case
  exceeded its budget after nine full page loads and is now split into Event route/API,
  lookup route/API and Products/mobile navigation cases, preserving all assertions. Venue mobile deletion
  now scrolls the grid to its virtualized action column and back before verifying removal;
  the reload assertion waits for save/navigation completion. Focused reruns passed those
  corrected cases, giving **19 distinct browser cases passed across runs**. The last two
  disabled-route cases passed 2/2; Products/mobile passed separately, as did the Venue CRUD
  case and the refreshed filter/form capture cases. No test/fixture timeout was increased.
- Root lint/typecheck/build and tools TypeScript passed. The final build executed admin and
  reused 12 cached prerequisites/backend tasks; those cache hits are not new runtime proof.
  Real DB/federation/browser cases above ran against guarded fixtures. The existing bundle
  warning remains at about 3.32 MB minified / 996 KB gzip while both UI libraries are present.
- Visually reviewed the Venue list, filters and editor against the original Aurora Member
  and Create Event pages at matching 1440×1000 and 390×844 viewports. The shared Products
  composition was also reviewed. Captures disable animations and reset form scroll so a
  transition or prior input focus is not mistaken for a layout defect. Temporary captures
  under ignored `artifacts/aurora/` were deleted after review; `.agents/` contains no images.
- A read-only live Chromium check verified Venue loading, sorting, reload and the filter
  panel with no page errors. Fixture processes/schemas and the task-started Aurora preview
  were closed. Normal development services remain available.
- All five local HTTP endpoints returned 200. The existing gateway development watcher was
  reloaded to pick up the additive Venue sort schema; the source bytes were restored, and
  the live sorted Venue query returned the expected store data. Markdown links and
  `git diff --check` passed. No full regression or commit was requested or performed.

Speakers/Tags follow in module step 2 below. Final package removal still waits until the
last real consumer is migrated. User acceptance of Venues is not implied by passing checks.

## Module migration step 2: Speakers and Tags

- Replaced Speaker/Tag list/editor/form Ant Design markup with Aurora/MUI. These modules
  use the same Invoice header, Member table/filter/menu/selection and Create Event aside
  composition as Products and Venues.
- Moved the verified Venue list behavior into the existing Reference `LookupList`, now
  shared by Venues, Speakers and Tags. Concrete adapters supply their columns, scoped
  resource and deletion guidance. `LookupFilters` shares their name/status controls;
  the separate VenueFilters file is removed. No universal CRUD framework was introduced.
- Forms, editors, operations, providers and backend services/repositories remain concrete.
  Optional Speaker email/biography normalize to null; Tag color uses a HEX field, native
  color input and preview. Duplicate-name responses retain the draft and focus Name.
- Added optional Speaker/Tag sorting inputs without persistence migrations. Sorting runs
  before pagination with ID descending ties, null email last and Active/Inactive label order.
  Existing search, inactive/selected-ID relation lookups and store scoping are preserved.
- Batch deletion reports actual success counts and individual failures. Referenced Speakers
  and Tags retain their existing protection, including relations to trashed Events.
- Removed Ant Design use from the three supporting entity screens and their shared list.
  No dependencies were added or removed; Events, Sessions, relation selectors, media,
  history and store fallback screens still require the legacy library and shared styles.
- Updated README, the implementation index, architecture, development, requirements and
  test guidance. The current working diff also contains the earlier shell/Products/Venues
  work and screenshot deletions; those changes are preserved and no commit is made.

### Speaker/Tag validation

Executed from the repository root (the existing Node.js 24 runtime):

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run codegen
npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:reference -- speakers.service.spec.ts tags.service.spec.ts --output-style=stream
npm run test:reference:db -- events.db.spec.ts --testNamePattern='sorts .* lookups|validates supporting fields|treats punctuation' --output-style=stream
npm run test:gateway:db -- federation.db.spec.mts --testNamePattern='sorts (Speaker|Tag) pages' --output-style=stream
npm run test:admin -- lookup-forms.test.tsx reference-workspace.test.tsx venue-list.test.tsx data-provider.test.ts --output-style=stream
npm run test:admin -- reference-workspace.test.tsx store-workspace.test.tsx --output-style=stream
npm run test:admin -- reference-workspace.test.tsx --testNamePattern='keeps a pending' --output-style=stream
npm run test:smoke -- lookups-aurora.smoke.spec.mts --output-style=stream
npm run test:smoke -- lookups-aurora.smoke.spec.mts --grep='list shares' --output-style=stream
npm run test:smoke -- venues-aurora.smoke.spec.mts events.smoke.spec.mts products.smoke.spec.mts reference-layout.smoke.spec.mts --grep='Aurora Venues|Speaker and Tag|a pending mutation stays|compact navigation' --output-style=stream
npm run lint
npm run typecheck
npm run build
```

Results:

- Service **4**, selected PostgreSQL **4** (12 unselected), offline schema **3** and real
  gateway **2** (21 unselected) passed. Guarded fixtures cleaned up their own schemas/processes.
- Admin runs passed **34**, then **21**, covering **48 distinct cases**. The final focused
  rerun passed **4** pending-save cases (7 unselected) after fixing two lint issues in the
  test's arrow/matcher expressions; assertions were preserved.
- All **9 distinct browser cases** passed. The first lookup run passed the two editor cases;
  two list assertions queried the accessibility-hidden grid while the filter dialog was
  open. Closing the dialog before checking rows corrected the tests. Both list reruns passed,
  followed by all five selected CRUD/store/navigation/Venue regressions. No timeout increases,
  disabled assertions or implementation workarounds were used.
- Root lint and typecheck passed; all five application typechecks executed, while generated
  prerequisites were cached. Root build passed with admin executed and 12/13 prerequisite/
  backend tasks cached; backend builds had already executed for the real gateway tests.
  The existing large-chunk warning remains, about **3.24 MB minified / 971 KB gzip**.
- Visually compared original Aurora Member/Create Event and integrated lists/forms at
  **1440×1000** and **390×844**. Corrected the Tag color-input label overlap and removed
  duplicate summary text. The corrected form was inspected again on both sizes. All **18**
  temporary captures under `artifacts/aurora/lookups` and `artifacts/aurora/venues` were deleted
  after review; screenshots remain optional test outputs, not source or runtime assets.
- A read-only Chromium check of the normal local admin verified both lists, server sorting,
  reload, editor navigation and the corrected Tag form without writes or page errors.
  Reloaded the existing gateway watcher for the additive schema and verified both live sort
  inputs. Its source bytes were restored. The temporary source preview and browser processes
  were closed; the user's five development services remain available.
- Markdown links and `git diff --check` passed; `.agents` contains no images. No full regression,
  commit, dependency change or database migration was performed.

Next: module step 3, Events list/editor/overview, preserving lifecycle, relationships and
specialized workflows. Its child workflows follow separately, then final Ant Design removal.

## Module migration step 3: Events

Implemented and verified. The next module step covers the remaining child workflows.

- Reused the Aurora header, DataGrid theme/pagination, filter drawer, row menu and form aside.
  Quick/drawer title/code search share a 300 ms draft; other filters apply on change. Invalid
  ranges stay editable without replacing the committed query. Preserved URL bookmarks,
  per-store columns, default sorting, list-return links and page-local selection.
- Active rows open Edit; View is explicit in the row menu. Trash rows open the read-only
  overview. Preserved atomic Publish/Archive/Trash/Restore, confirmation, saved status,
  relationships and scoped late-mutation behavior.
- Migrated Event fields, relation selection and Tiptap controls to MUI. Concrete draft validation
  preserves exact decimal strings, nullable values, conditional location and calendar rules.
  Native date/time fields convert Sofia wall time independently of the browser timezone and
  retain the stored offset in an untouched repeated autumn hour. No dependency was added.
- Form tabs retain drafts and open/focus errors. The Create Event aside holds status, featured,
  capacity, budget, summary and save/cancel; it follows the fields on mobile. The overview uses
  Member Profile section and details styling with real Event data.
- Session/Gallery/History behavior remains, with localized legacy surfaces. Session's relation
  selector shares the MUI component. Removed replaced Event/description CSS and the obsolete
  speaker-summary class. Full child-workflow redesign and final Ant Design removal are separate.
- Updated README, implementation index, architecture, usage, requirements and testing guidance.

### Event validation

Executed from the repository root:

```bash
npm run test:admin -- event-list.test.tsx event-workspace.test.tsx event-lifecycle.test.tsx event-description.test.tsx event-form-state.test.ts event-time.test.ts session-workspace.test.tsx --output-style=stream
npm run test:admin -- event-workspace.test.tsx event-form-state.test.ts store-workspace.test.tsx --testNamePattern='Event editor lifecycle|Event form values|requires delete confirmation|captures a pending create|reports partial batch deletion' --output-style=stream
npm run test:smoke -- events.smoke.spec.mts lifecycle.smoke.spec.mts --grep='Event create|pending Event|Event filters|bulk actions|delayed bulk' --output-style=stream
npm run test:smoke -- events.smoke.spec.mts rich-text.smoke.spec.mts sessions.smoke.spec.mts media.smoke.spec.mts reference-layout.smoke.spec.mts products.smoke.spec.mts --grep='Event create|Event filters|rich text|Sessions persist|gallery saves|switching stores cancels|compact navigation|pending mutation' --output-style=stream
npm run test:smoke -- events.smoke.spec.mts sessions.smoke.spec.mts --grep='Event create/edit|Event filters|Sessions persist' --output-style=stream
npm run test:smoke -- events.smoke.spec.mts --grep='Event filters' --output-style=stream
npm run lint
npm run typecheck
npm run build
```

- **30 distinct admin cases passed.** The seven-file selection passed 27/27; the final
  focused selection passed 9/9 with seven deliberately unselected cases. It rechecked six
  Event form/editor cases and covered three additional shared-menu/store cases. Repeat
  executions are not extra cases. Sofia wall-time coverage exposed browser-local parsing
  of nonexistent spring times; neutral UTC parsing now lets the existing Sofia converter
  validate them. Untouched repeated-hour offsets and exact decimal strings are preserved.
- **12 distinct browser cases passed across focused runs.** Coverage includes Event CRUD,
  filters/sorting/column persistence, mobile and dirty navigation, rich text, atomic lifecycle,
  Sessions, Gallery and pending mutation/store switches. Initial runs exposed obsolete Ant
  selectors and grid assumptions: tests now scroll virtualized columns into view and await
  the committed sort indicator before toggling again. The final complete filter case passed
  1/1, including reload, edits, mobile deletion and store switching. No timeout increase,
  removed behavioral assertion or production virtualization workaround was used.
- Root lint, typecheck and build passed. Admin typecheck/build executed; 12/13 generated and
  backend prerequisites were Nx cache hits. No new backend runtime evidence is claimed.
  Browser fixtures ran without cache using dedicated test schemas and closed their own
  processes/connections. The existing large-chunk warning remains, about **3.21 MB minified /
  963 KB gzip**. This step added no dependency, API change or database migration.
- The actual Aurora `theme/components/Autocomplete.tsx` presentation is registered for
  relation pickers and multi-value filters. Original Member, Create Event and Member Profile
  screens were compared with the integrated list/editor/overview at **1440×1000** and
  **390×844**. The form aside follows the fields on mobile as requested; the wide grid scrolls
  inside its container. No page-level horizontal overflow was found. Dark-mode relation
  selection and rich-text controls were also inspected.
- The normal local admin loaded list/editor/overview without JavaScript errors or data writes.
  All **20** temporary Event review captures were deleted after inspection; they are not runtime
  assets. The temporary Aurora preview and review browsers were closed, and the user's five
  development services remain available. Product documentation describes the implemented
  boundaries; this working plan holds progress and individual check results. Relative links in
  all seven changed documents and `git diff --check` passed; `.agents` contains no images.

Next: module step 4, Sessions and speaker assignment/summary, Gallery and History. Preserve
their parent Event/store/route lifecycle and specialized contracts while replacing presentation.
Module step 5 then covers remaining store states, obsolete CSS/providers and removal of Ant Design
after its last caller is migrated. No commit or full-regression run was performed in step 3.

## Module migration step 4: Event child workflows

Implemented and verified.

- Session editors reuse PageHeader, EditorAside and RelationSelect. Native date/time inputs
  share `eventInputInstant` with Event forms; the existing Sofia converter and untouched
  repeated-hour offsets are preserved. Validation, field-error focus, dirty navigation,
  parent bounds and captured store/Event/route mutations remain concrete feature behavior.
- Session programs adapt Aurora Create Event's rounded, draggable sections. Native drag and
  move buttons retain explicit Save/Cancel order; title/row clicks edit and RecordActions
  supplies Edit/Delete. The speaker summary derives its unique roster from scoped Sessions.
- Gallery uses the Aurora upload panel and image surfaces with a native single-file picker,
  MUI progress, metadata/removal dialogs and previous/next image preview with arrow keys/Escape.
  Existing hooks retain upload cancellation, private read URLs, independent mutations and
  order-draft coordination with the Event editor. No upload transport or API was replaced.
- History uses the original Aurora table overrides with expandable escaped excerpts and
  server pagination of 20 entries. No commercial grid or lightbox dependency was added.
- Removed child legacy wrappers, Session's legacy page surface, replaced CSS and the unused
  Ant Design `useFieldErrors` hook. Reference features now have no Ant Design imports; store
  discovery/unavailable states and application providers remain for module step 5.
- Updated the existing reference index, architecture, usage, requirements, testing and README.
  Product docs describe current behavior; validation results are recorded only here.

### Module step 4 validation and review

Executed from the repository root (with stream output for the selected tests):

```bash
npm run test:admin -- session-workspace.test.tsx event-gallery.test.tsx event-lifecycle.test.tsx event-time.test.ts event-form-state.test.ts event-workspace.test.tsx --output-style=stream
npm run test:admin -- event-gallery.test.tsx --output-style=stream
npm run typecheck -- --projects=admin
npm run test:smoke -- sessions.smoke.spec.mts media.smoke.spec.mts lifecycle.smoke.spec.mts reference-layout.smoke.spec.mts products.smoke.spec.mts --grep='Sessions persist|gallery saves|switching stores cancels|bulk actions|delayed bulk|compact navigation|pending mutation' --output-style=stream
npm run test:smoke -- lifecycle.smoke.spec.mts --grep='bulk actions' --output-style=stream
npm run lint
npm run typecheck
npm run build
git -c core.safecrlf=false diff --check
```

- **24 distinct admin cases passed across focused runs.** The initial selection passed 23/24;
  the remaining Gallery case accessed controls beneath a closing MUI dialog. It now awaits
  that transition, and the Gallery file passed 3/3. The new Session case preserves both
  distinct UTC instants in Sofia's repeated autumn hour. Existing cases retain parent bounds,
  field errors, inactive relations, ordering conflicts and delayed store/route isolation.
- **7 distinct browser cases passed across focused runs.** Six passed in the first selection:
  Session CRUD/relations/native drag, Gallery save/preview/keyboard navigation/removal, upload
  cancellation on store switch, delayed bulk callbacks, Products pending-store isolation and
  compact navigation. Lifecycle exposed a real mobile History overflow: MUI interpreted the
  visually hidden header label's numeric width of 1 as 100%. Explicit one-pixel dimensions
  fix it without masking page overflow. The complete bulk/Trash/history/restore case then
  passed, including preservation of the Event program. No assertions or timeouts were weakened.
- Root lint, tools/admin TypeScript and build passed. Lint's shorthand-void callback finding
  in the new Session test was fixed. Admin typecheck/build executed; the four unchanged backend
  targets and generation prerequisites used valid Nx cache entries. Browser fixtures executed
  against dedicated test schemas and cleaned up their own processes and connections.
- The main admin JavaScript bundle is about **2.67 MB minified / 796.56 KB gzip**, down from
  about 3.21 MB / 963 KB at module step 3. Vite still reports the existing large-chunk warning.
  No dependency, lockfile, backend contract or migration was changed in this step.
- Original Aurora Create Event and integrated Session forms were compared at matching
  1280×800 and 390×844 viewports in light and dark modes. Review also covered populated
  Session programs, Gallery and expanded History from the browser fixture, plus 320×800
  Gallery and 390×844 History layouts. Live review was read-only, had no page errors and
  confirmed that the page itself does not overflow horizontally. All 18 temporary review
  captures were inspected outside `.agents` and deleted afterward; native test artifacts remain
  ignored. The source preview and review browsers were closed. Development services remain running.
- The reference index, architecture, usage, requirements, testing and agent guide describe
  implemented behavior. Relative links in all eight changed documents and whitespace checks
  passed. `.agents` contains no images.

Next: module step 5, migrate store discovery/loading/error/empty/unavailable states, remove the
last Ant Design providers and obsolete styles, then remove unused direct/transitive libraries
after checking actual callers. Preserve gateway diagnostics, store switching and Reference
availability. No commit or full-regression run was performed in step 4.

## Module migration step 5: final Ant Design removal

Implemented and verified.

- StoreWorkspace's discovery/loading/error/retry/empty/unavailable states and the disabled
  Reference notice use Aurora/MUI. Discovery reuses PageHeader and themed store buttons.
  Refine requests, available-store selection, resource identities and keyed route/store
  subtrees retain their existing behavior; no store-administration feature was introduced.
- Removed ConfigProvider/AntApp, the Ant Design reset stylesheet, legacy-content prop/CSS,
  one redundant content wrapper and the temporary Emotion CacheProvider used for coexistence.
  MUI CssBaseline and the standard Emotion cache now apply throughout. Removed the obsolete
  jsdom pseudo-element shim while retaining MUI's required matchMedia shim.
- Removed the direct `antd` and `@emotion/cache` declarations. npm removed 63 lockfile package
  entries, added none and changed no retained versions. Emotion cache remains transitively
  required by MUI; Emotion peers, Tiptap peers, GraphQL/codegen and actual shell dependencies
  remain. `npm ls --workspace @holita/admin --depth=0` passes. No Ant Design package or import
  remains, and the local import audit found no orphaned production source files.
- Updated the authoritative documentation, agent guide and admin skill to describe one
  Aurora/MUI UI. Historical phase notes remain historical. No API/SDL, migration, database
  data, dependency version or generic CRUD abstraction changed.
- The two focused component files cover 23 distinct cases. The first run passed 22/23;
  the new loading assertion initially also matched the test harness's route output status.
  Scoping it to the actual main region fixed the selector; that case passed on rerun.
  Root lint and root TypeScript checks pass. All 13 browser cases passed, including
  shell menus/navigation, controlled discovery failure/empty states, real Products CRUD,
  delayed store/route callbacks, Reference disabled mode and compact Event navigation.
- Production build currently produces about 2.23 MB JavaScript / 654.81 KB gzip, compared
  with 2.67 MB / 796.56 KB at step 4. The existing large-chunk warning remains visible.

### Module step 5 validation and review

Executed from the repository root:

```bash
npm uninstall --workspace @holita/admin antd @emotion/cache --ignore-scripts
npm ls --workspace @holita/admin --depth=0
npm run test:admin -- store-workspace.test.tsx reference-workspace.test.tsx --output-style=stream
npm run test:admin -- store-workspace.test.tsx --testNamePattern='keeps loading' --output-style=stream
npm run lint
npm run typecheck
npm run test:smoke -- products.smoke.spec.mts aurora-shell.smoke.spec.mts reference-disabled.smoke.spec.mts reference-layout.smoke.spec.mts --output-style=stream
npm run build
npm exec -- eslint apps/admin/src/features/stores/store-workspace.tsx
npm run test:smoke -- products.smoke.spec.mts --grep='store discovery recovers' --output-style=stream
git -c core.safecrlf=false diff --check
```

- **23 distinct component cases and 13 distinct browser cases passed.** One selector correction
  is described above. Mobile visual review found a wrapping Retry label; `whiteSpace: nowrap`
  fixes it and the complete discovery browser scenario passed again. Repeat executions are
  not extra cases. Assertions, retry policy and timeouts were not weakened.
- Root lint passed; focused ESLint also passed after the final Retry style change. Tools and
  all five application typechecks executed successfully. The first smoke prerequisite build
  executed all five applications; root build subsequently reused four backend outputs and
  executed admin again. The final browser rerun rebuilt/typechecked admin after the style fix.
  These results do not claim a fresh npm ci or full-regression/CI execution.
- Compared the source Aurora and holita at matching 1440×1000 desktop and 390×844 mobile
  sizes. Review covered light/dark surfaces, shared header/typography, store discovery and
  unavailable states, the corrected error action, existing CRUD form composition, shell
  menus and expanded/collapsed/mobile navigation. Live read-only review had no page errors
  or horizontal page overflow. All 18 temporary review captures were deleted after inspection;
  native test output remains ignored. The source preview and review browsers were closed.
  Relative links in all nine changed documents and whitespace checks pass; `.agents` has no images.
- After backend builds, the pre-existing dev watch group had stopped serving its three
  subgraphs. Restarted that group with the existing `npm run dev`, then verified core,
  products and reference health, gateway store discovery and the live admin. Existing data
  and configuration were preserved. The restored dev group remains running for user review;
  test fixtures closed their separate processes/connections and dedicated schemas.
- Product documentation, agent instructions and the admin skill now describe the implemented
  Aurora/MUI-only application and its concrete reuse boundaries. No feature or backend code
  was changed to work around development-process recovery. No commit was made.

Next: the user's visual acceptance and deferred cosmetic notes. Further module capabilities
remain separate feature work; there is no remaining Ant Design migration phase.

## Phase 5: approved Products scope

- Invoice list: breadcrumb, title and primary Create action; at most three genuinely useful
  secondary actions. No import/export placeholders.
- Member list: actual Community MUI X DataGrid, Aurora styling, checkboxes, three-dot menus,
  quick search and the advanced filter drawer. Status applies immediately, text after 300 ms.
- Create Event: real form composition with a sticky desktop right column for status,
  settings/summary and save actions; the column follows the fields on mobile.
- Record click opens the full edit page. Read-only profile views are not required for Products.
- The universal batch action is deletion. Products implements page-local selection, explicit
  count confirmation and sequential existing scoped deletes with partial-failure reporting.
  Additional batch actions remain module-specific. Other modules are migrated after Products.
- Product search/status/SKU filters and sorting use additive SDL/provider/repository changes;
  no database migration, new persistence model or batch endpoint is needed.
- New direct dependency: `@mui/x-data-grid` 9.14.0, matching the selected source, with five
  added lockfile package entries. Existing package versions are retained. No extra form,
  state-management, notification, MUI Lab or commercial grid dependency is introduced.
- Source references: `pages/apps/invoice/InvoiceLists.tsx`, ecommerce `common/PageHeader.tsx`,
  `sections/common/PageBreadcrumb.tsx`, Member `list-view`, `TopActionsSection`, `filter-drawer`,
  Create Event `main/EventOverview.tsx`, `aside/EventAside.tsx`, and their component overrides.
- Original and integrated Products pages were visually reviewed. Temporary screenshots
  and capture metadata have been deleted; the source references and browser cases remain.
- Replaced Products Ant Design markup, its width restriction and its notification hook are
  removed. Reference and store-selection presentation keep their existing Ant Design code.

### Phase 5 Products validation and review

Executed from the repository root:

```bash
npm run codegen
npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:products -- products.service.spec.ts
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:products:db -- products.db.spec.ts
npm run test:admin -- product-form.test.tsx data-provider.test.ts store-workspace.test.tsx --skip-nx-cache
npm run test:admin -- store-workspace.test.tsx --skip-nx-cache
npm run test:gateway:db -- federation.db.spec.mts --testNamePattern="forwards Product search|creates products|enforces store scoping"
npm run test:smoke -- products-aurora.smoke.spec.mts products.smoke.spec.mts reference-layout.smoke.spec.mts reference-disabled.smoke.spec.mts
npm run test:smoke -- reference-disabled.smoke.spec.mts
npm run lint
npm run typecheck
npm run build
```

- Schema contracts: **3 passed**; Products service: **7 passed**; Products DB: **12 passed**;
  selected gateway federation: **3 passed**, with 17 deliberately unselected cases.
- Admin: **27 distinct cases passed**. The final test-provider typing adjustment was
  followed by another **10/10** store-workspace run; repeat executions are not extra cases.
- Browser: **8 distinct cases passed**. The combined run passed 7 and reached the 60-second
  test limit during the last mobile navigation step of Reference-disabled after nine full
  page loads. That unchanged case passed separately in 43 seconds. No timeouts, assertions,
  retries or data fixtures were weakened. Browser fixtures closed their processes/schemas.
- Review fixes addressed overlapping filter URL updates and physical row-menu clicks.
  React Router's DOM provider supplies synchronous filter commits. Component tests use the
  same real flushSync with their existing router entry point to avoid mixed module contexts.
- Root lint/typecheck/build passed. Backend build/generation cache hits are not counted as
  new execution evidence; DB/federation/browser targets ran against their guarded fixtures.
  Existing large-bundle and Ant Design compatibility warnings remain. The admin bundle is
  approximately 3.31 MB minified / 994 KB gzip while both UI libraries remain installed.
- The lockfile adds five entries and changes no existing versions. Source and integrated
  screenshots were reviewed at matching desktop/mobile widths; dark mode was also reviewed.
  All 31 previously moved image files retain their original bytes, and `.agents` has no images.
- Formatting, local Markdown links and `git diff --check` passed. No full regression or
  commit was requested or performed. Temporary reference/validation processes were stopped.

### Products sorting validation

Products now sorts Name, SKU and Status on the server before pagination. The URL carries
one selected field/direction; the third click restores newest-first ordering. Filter changes
retain sorting, Clear filters retains sorting/page size, and sort changes reset page/selection.
No new dependency or persistence migration was added for sorting.

```bash
npm run codegen
npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:products -- products.service.spec.ts --skip-nx-cache
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:products:db -- products.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts --testNamePattern="Product search, filters and sorting"
npm run test:admin -- data-provider.test.ts store-workspace.test.tsx --skip-nx-cache
DEBUG_PRINT_LIMIT=100000 npm run test:admin -- store-workspace.test.tsx --testNamePattern="partial batch|unsent batch|delete confirmation" --skip-nx-cache
npm run test:smoke -- products-aurora.smoke.spec.mts products.smoke.spec.mts --grep="sorts across|synchronizes quick|delayed product response"
npm run test:smoke -- products-aurora.smoke.spec.mts --grep="sorts across"
npm exec -- eslint apps/products/src/products/products.service.ts apps/products/src/products/products.repository.ts apps/products/src/products/products.service.spec.ts apps/products/test/products.db.spec.ts apps/admin/src/data/products-provider.ts apps/admin/src/data/data-provider.test.ts apps/admin/src/features/products/product-list.tsx tools/graphql/federation.db.spec.mts tools/browser/products-aurora.smoke.spec.mts
npm run typecheck:tools
```

- Schema **3**, service **8**, Products DB **14**, selected federation **1** passed.
  DB cases check both directions for all three fields, tie-breaking, filters, store isolation,
  pagination and invalid sort inputs. Federation selected one case and deliberately skipped 19.
- Admin **24 distinct cases passed**: 14 provider and 10 store-workspace. Three workspace
  cases initially failed while waiting for rows in the combined run; the focused rerun passed
  all three unchanged, with seven unselected cases. No timeouts or assertions were relaxed.
- Browser **3 distinct cases passed**, using real services and isolated test schemas.
  The new sorting case checks multiple pages, direction, default-order reset, selection reset,
  reload/history and filter preservation. Its first run exposed a test selector that did not
  account for the header's added accessible Sort button; the corrected selector passed.
  Shared quick/panel search and delayed-response store isolation also passed.
- Focused ESLint, tools TypeScript, schema validation and the smoke prerequisite builds passed.
  Admin TypeScript and Vite build executed; cached backend builds are not new runtime proof.
  The existing large-bundle warning remains. No full regression or commit was requested.
- A final read-only check at http://127.0.0.1:11081 verified server sorting, its visible
  direction and reload without page errors. The existing gateway watcher was reloaded to
  load the additive schema; all four backend health endpoints returned 200 afterward.

The user accepted Products' appearance with the shared-search correction described above.
Cosmetic notes can remain deferred. Venues now uses the same source-based presentation.
Next module work covers Events and its existing child workflows,
preserving each module's data contracts, relation controls and deletion constraints.
The whole migration is complete only when those modules are verified, their replaced UI is
removed, the final Ant Design uses/dependency are removed, and the user accepts the result.

Shared-search follow-up: the quick field and panel share the same draft and URL filter.
Clear filters resets search, status and SKU and cancels pending text commits. Only user
text edits schedule a debounced update, preventing an old status from returning after reset.
The original long browser case exceeded its time budget when extended, so the new behavior
now has a separate focused case without increasing timeouts or dropping existing assertions.
`npm run test:smoke -- products-aurora.smoke.spec.mts` passed its two existing cases; the
new case exposed the reset race. After the fix,
`npm run test:smoke -- products-aurora.smoke.spec.mts --grep="synchronizes"` passed **1/1**,
including both input directions, combined results, reload and reset. Focused ESLint and
the target's admin TypeScript/Vite build passed. Desktop/mobile captures were reviewed.

## Phase 4 integration review

- Search now anchors to the current desktop control and tracks the top bar's width
  transition with a scoped `ResizeObserver`. Switching between mobile and desktop keeps
  the search text; closing returns keyboard focus to the current trigger.
- Notification read/remove actions restore focus inside the panel when their control is
  disabled or removed. Escape closes the panel and returns to the bell button.
- Two additional browser cases cover 899/900 and 1199/1200 px boundaries, open overlays,
  preserved Event drafts, search navigation confirmation, and cancelled/confirmed store
  switching. Existing menu assertions now verify focus after notification actions.
- Profile capture waits for the opening transition to finish. The missing text in the
  earlier capture was a capture-timing issue; the rendered colors and profile component
  required no change.
- Application changes are limited to search and notifications. No dependencies, CRUD
  presentation, GraphQL contracts or persistence behavior are changed in this phase.
- The existing development servers remain on their standard ports. PostgreSQL was
  started through `db:up`; setup preserved existing data and passwords. Browser tests
  continue to own their separate test schemas and processes.
- The live development preview loaded the actual Products and Reference Events lists
  with store selection and no page errors. Gateway, core, products and Reference health
  endpoints returned 200. This read-only preview check is separate from isolated CRUD tests.

### Validation evidence

Commands ran from the repository root:

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm exec -- eslint apps/admin/src/layout/search-box.tsx apps/admin/src/layout/notification-menu.tsx tools/browser/aurora-shell.smoke.spec.mts
npm exec -- nx run admin:typecheck --output-style=static
npm run typecheck:tools
npm run test:admin -- store-workspace.test.tsx --skip-nx-cache
npm run test:smoke -- aurora-shell.smoke.spec.mts
npm run test:smoke -- aurora-shell.smoke.spec.mts --grep="Aurora Stacked"
npm run test:smoke -- aurora-shell.smoke.spec.mts --grep="Aurora menus"
npm run test:smoke -- products.smoke.spec.mts reference-layout.smoke.spec.mts reference-disabled.smoke.spec.mts
npm run test:smoke -- reference.smoke.spec.mts events.smoke.spec.mts --grep="Venue CRUD|Event create/edit|Speaker and Tag|pending Event create|Event filters"
```

- Store workspace: **8 passed**, including unavailable stores, delayed reads and pending
  mutations across store/editor changes. Focused lint and admin/tools typechecks passed.
- Shell: **4 distinct cases passed**. The final full shell run passed 3 cases and timed out
  in the long navigation case while taking a mobile screenshot. That case passed unchanged
  when run separately (33.7 seconds); no timeout, retry setting or assertion was weakened.
  The menu case also passed after stabilizing captures around menu/theme transitions.
- Products, compact navigation and disabled Reference: **6 passed**. Reference selection:
  **5 passed**, covering Venue CRUD, Event create/edit, Speaker/Tag CRUD, pending Event
  creation across stores, and preserved Event filters/history/reload.
- Browser target prerequisites include a fresh admin TypeScript/Vite build; it passed.
  Existing backend build/generation cache hits are not counted as new backend validation.
  Main bundle remains about 2.78 MB minified / 835 KB gzip. The existing large-chunk and
  Ant Design/React compatibility warnings remain visible.
- Initial review failures reproduced invalid/stale search positioning and lost focus after
  notification actions. The final cases exercise these failures with stronger assertions.
  Repeated executions are not counted as additional distinct cases.
- Matching original/integrated desktop, hover, tablet, mobile drawer, profile, notification,
  theme and dark captures were reviewed separately from test assertions. The open-search
  transition captures at 899/900 px supplement the existing reference sizes.
- Edited code/capture metadata passed focused Prettier checking. Documentation links and
  `git diff --check` passed. Browser fixtures closed their processes and test schemas;
  existing development servers remain available for user review. No full regression ran.

### User acceptance boundary

Review the sidenav and its collapse/hover behavior, top controls, store selector, mobile
drawer and overall spacing in the live admin. Existing Ant Design CRUD remains intentional
inside the Aurora shell, including its light content surface in dark mode. Search/language/
profile/notification examples remain separate from business data and authentication.
After explicit acceptance, phase 5 migrates Products first, then the Reference modules.

## Phase 3 validation evidence

All commands ran from the holita repository root. The final executions passed:

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run lint
npm run typecheck
npm run build
npm run test:admin -- store-workspace.test.tsx --skip-nx-cache
npm run test:admin -- reference-workspace.test.tsx event-workspace.test.tsx event-list.test.tsx event-gallery.test.tsx --testNamePattern="hides navigation|late Venue list|dirty store navigation|restores a bookmarked query|late cover mutation" --skip-nx-cache
npm run test:smoke -- aurora-shell.smoke.spec.mts products.smoke.spec.mts reference-layout.smoke.spec.mts reference-disabled.smoke.spec.mts
npm run test:smoke -- reference.smoke.spec.mts events.smoke.spec.mts rich-text.smoke.spec.mts media.smoke.spec.mts --grep="Venue CRUD|pending Event create|Event filters, columns|oversized rich text|switching stores cancels"
```

- Store component file: 8 passed. Reference selection: 5 passed, 11 intentionally unselected.
- Shared shell/Products/navigation browser selection: 8 passed. Additional affected store
  selectors in Reference, Events, rich text and gallery: 5 passed.
- The final search keyboard-handler adjustment also passed
  `npm exec -- eslint apps/admin/src/layout/search-box.tsx`; root typecheck/build and both
  final browser selections ran after that adjustment.
- No test timeouts, retries, mocks or assertions were weakened. Tests used the existing
  dedicated database fixture and its process/schema cleanup. No full regression was run.
- `git diff --check` and edited documentation's local links passed review. Existing Ant
  Design/React compatibility warnings remain; there were no page runtime errors in the
  selected shell checks.

## Integrated holita preview

Review captures and metadata are temporary local outputs in Git-ignored `artifacts/aurora/`,
outside `.agents/`. The user requested deletion of the existing captures after review.
Keep future captures only until visual acceptance; documentation must remain usable without them.

The shell review covered expanded/collapsed navigation, hover expansion, search, notifications,
profile, language, theme menus, tablet/mobile drawers, dark mode and the 899/900 px search
transition. Captures used matching reference viewports and isolated test data. The store
selector, holita navigation labels and local example data are intentional adaptations.
The behavioral browser cases and their reproduction commands remain in this plan.

## Selected reference

- Source: `../themes/aurora/vite-ts` relative to the holita repository root.
- Aurora package version: `2.4.0`. Installed package versions used for capture are listed
  below; these are observations, not permission to upgrade holita's existing dependencies.
- Layout: `Sidenav`; sidenav shape: `Stacked`; navigation color: `default`.
- Initial preset: `default-light`; font: `Plus Jakarta Sans`, base size 16; direction: LTR.
- Preserve the top search, language, theme, notification and profile controls. Module
  navigation stays in the sidenav. Preserve the theme menu, including its existing preset
  and color controls; it is more than a dark-mode toggle.
- Use holita branding and real holita routes. Example search, notification and profile
  data are local presentation data; they do not represent authenticated identity or records.
- Language selection is initially a demo interaction. Keep product text in English;
  real translations and RTL support are not part of the shell integration.

The original `/pages/starter` route was used to capture the shell without building a
second example application. Its central starter illustration, demo navigation labels,
Purchase Now button and floating Customize panel are not holita requirements. Footer
geometry is a reference; product text, destination links and version data belong to holita.

### Reference states

| State                            | Viewport    |
| -------------------------------- | ----------- |
| Expanded desktop                 | 1440 × 1000 |
| Collapsed desktop                | 1440 × 1000 |
| Collapsed rail hover             | 1440 × 1000 |
| Search popover                   | 1440 × 1000 |
| Notification panel               | 1440 × 1000 |
| Profile menu                     | 1440 × 1000 |
| Language menu                    | 1440 × 1000 |
| Theme presets and primary colors | 1440 × 1000 |
| Medium-screen navigation         | 1024 × 900  |
| Mobile header                    | 390 × 844   |
| Mobile navigation drawer         | 390 × 844   |
| Dark desktop                     | 1440 × 1000 |

The reference screenshots, capture metadata and fingerprint file were temporary review
materials and have been deleted. The original has animated and time-dependent demo content;
compare shell geometry and behavior at the viewports above when repeating the review.

To reproduce with the installed theme dependencies, run from the Aurora `vite-ts` folder:

```bash
npm run dev -- --host 127.0.0.1 --port 15181 --strictPort
```

Open this route in a fresh browser context:

```text
http://127.0.0.1:15181/pages/starter?navigationMenuType=sidenav&sidenavType=stacked&themePreset=default-light&navColor=default&locale=en-US
```

Stop the temporary reference server after review and delete captures after visual acceptance.

### Geometry and behavior to retain

- Expanded sidenav width: 300 px. Stacked icon rail/collapsed width: 72 px.
- Standard top toolbar: 82 px at `md` and above, 64 px below; the measured desktop
  header includes its border and is 83 px tall.
- Aurora uses MUI breakpoint defaults: `sm` 600, `md` 900, `lg` 1200, `xl` 1536 px.
  At `md`, navigation collapses to the rail; expansion uses a backdrop. Below `md`,
  the original uses a temporary drawer with `SidenavDrawerContent`, not two stacked columns.
- At wide widths, keep expanded/collapsed navigation, hover expansion, active-item styling,
  nested-menu expansion and the relationship between drawer, header and content widths.
- Desktop search has a 420 px maximum width. Narrow screens use its button/dialog variant.
- Keep original typography, component variants, spacing, borders, shadows, menu surfaces
  and MUI transitions. Source selection does not justify substituting generic MUI styling.
- The shell content area fills its available width. The old global 1280 px content cap
  must not constrain the new shell; individual legacy pages can retain their own limits.

## Source inventory

Paths in this table are relative to the Aurora `vite-ts/src` directory. Only the selected
component subtree is a candidate for copying into `apps/admin`; holita must not import the
sibling theme directory at runtime. Destination grouping can stay small: `layout/` for the
shell and its controls, `theme/` for theme definitions, and the existing store feature for
application orchestration. The selected files now live in those directories; phase 3 excludes unused source branches.

| Source                                                                                                                                                                              | Reuse and adaptation                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layouts/main-layout/MainLayout.tsx`                                                                                                                                                | Preserve its Stacked/Sidenav composition, geometry, content and footer. Remove unselected Topnav, Combo, Slim and default-sidenav branches and imports.                                                                                                                                                 |
| `layouts/main-layout/sidenav/StackedSidenav.tsx`                                                                                                                                    | Reuse rail, secondary pane, hover, collapse and breakpoint behavior. Supply holita navigation/profile inputs; detach demo auth, Docs search and sitemap.                                                                                                                                                |
| `layouts/main-layout/sidenav/SidenavDrawerContent.tsx`, `SidenavSimpleBar.tsx`, `NavItem.tsx`                                                                                       | Preserve the original mobile navigation and nested items. Supply holita routes; keep active selection aligned with reload, browser history and store changes.                                                                                                                                           |
| `layouts/main-layout/sidenav/NavItemPopper.tsx`                                                                                                                                     | Retain only if reached by the selected navigation modes. Stacked nested items use inline Collapse; do not bring unused default-sidenav behavior through an import.                                                                                                                                      |
| `layouts/main-layout/NavProvider.tsx`                                                                                                                                               | Retain local navigation state and selected responsive behavior; adapt demo paths, type assertions and hook usage to repository rules. Do not move store or CRUD state here.                                                                                                                             |
| `layouts/main-layout/app-bar/index.tsx`, `common/AppbarActionItems.tsx`                                                                                                             | Reuse toolbar, search placement and action spacing. Add a compact real store selector with a usable narrow-screen placement. Review this explicit holita addition during shell acceptance.                                                                                                              |
| `layouts/main-layout/common/search-box/`                                                                                                                                            | Reuse field, popover, dialog and result presentation. Supply a small local result set and valid holita destinations. Search/filter example entries locally without a second data provider.                                                                                                              |
| `layouts/main-layout/common/NotificationMenu.tsx`, `components/sections/notification/NotificationList.tsx`, `NotificationListItemAvatar.tsx`, `NotificationActionMenu.tsx`          | Reuse panel/list/avatar visuals with explicit local data and callbacks. Local read/remove actions must update local state; detach demo routes and imports of the complete demo user dataset.                                                                                                            |
| `layouts/main-layout/common/ProfileMenu.tsx`                                                                                                                                        | Preserve profile menu presentation with an explicit example profile. Detach `useAuth`, `demoUser`, sign-in/out routes and session operations.                                                                                                                                                           |
| `layouts/main-layout/common/LanguageMenu.tsx`, `locales/languages.ts`                                                                                                               | Preserve appearance and local selection; no translation backend or automatic RTL switch in this stage.                                                                                                                                                                                                  |
| `layouts/main-layout/common/ThemeToggler.tsx`, `components/settings-panel/theme-preset/{ThemeList,ThemeListItem,ThemeRadio,PrimaryColorPicker}.tsx`                                 | Retain the topbar preset/color menu. The color picker uses MUI swatches and does not require `@uiw/react-color`. Remove URL query clearing. The full floating settings panel is not needed.                                                                                                             |
| `providers/SettingsProvider.tsx`, `reducers/SettingsReducer.ts`, `hooks/useThemeMode.tsx`, `providers/BreakpointsProvider.tsx`                                                      | Keep only UI configuration, local preferences and responsive behavior used by the selected shell. Detach chart utilities, translation side effects and demo-wide settings. Keep hooks valid under holita lint rules.                                                                                    |
| `providers/ThemeProvider.tsx`, `theme/theme.ts`, `theme/{colors,palettes}/`, `typography.ts`, `shadows.ts`, `mixins.ts`, `sxConfig.ts`, `primaryColorOverride.ts`, `types/theme.ts` | Preserve the theme values and type augmentations used by selected components/presets. Narrow the theme assembly to needed overrides rather than importing every widget's override.                                                                                                                      |
| `theme/components/`                                                                                                                                                                 | Initial candidates include AppBar, Toolbar, Drawer, Paper, Stack, Typography, Button/ButtonBase, List, Menu, Link, Avatar, Divider, Backdrop, Popover, Popper, Dialog, Chip, Switch, Radio, Tooltip and required text-field/selector overrides. Final membership follows actual imports and visual use. |
| `theme/components/CssBaseline.tsx`, `theme/styles/{simplebar,popper,keyFrames}.ts`                                                                                                  | Retain required base and shell styles. Remove imports for charts, calendars, date pickers, carousel, rich widgets and unrelated accessibility/demo filters. Verify CSS reset interaction with legacy Ant Design content.                                                                                |
| `components/base/{IconifyIcon,SimpleBar,StatusAvatar,Image}.tsx`, `components/styled/OutlinedBadge.tsx`, `lib/iconify/`                                                             | Reuse the small primitives. Register only needed icon data locally, including dynamically selected menu/status/theme icons. Preserve SimpleBar where used by search, notifications and mobile navigation.                                                                                               |
| `lib/utils.ts`, `lib/constants.ts`                                                                                                                                                  | Extract only used color/channel and local-preference helpers and layout constants. Do not copy the whole utility module, which imports the TypeScript compiler for demo code transformation.                                                                                                            |
| `components/common/Logo.tsx`, `layouts/main-layout/footer/index.tsx`, `index.html`                                                                                                  | Preserve component placement and sizing while applying holita identity, safe destinations and the required font families. Carry only selected image/font assets.                                                                                                                                        |

### Required adaptations that preserve application behavior

1. **Route queries:** `ThemeToggler` and `ThemeList` call `setSearchParams({})`. Remove that
   demo coupling; opening/selecting a theme must retain list filters, pagination and history.
2. **Navigation:** Aurora's complete `routes/sitemap` and `routes/paths` include Docs and
   unrelated apps. Provide Products and enabled Reference sections from holita. Keep one
   existing React Router instance and preserve navigation blockers.
3. **Selection:** Stacked's initial selected group is established on mount. Verify subsequent
   route/store changes and browser history, rather than assuming its demo behavior covers them.
4. **Notifications:** the example bell panel is separate from real CRUD success/error messages.
   Existing mutation callbacks and their store/route lifetime remain unchanged.
5. **Preferences:** use holita names consistently for storage keys, CSS variables and data
   attributes; update related hardcoded theme CSS references together. Do not read Aurora's
   demo settings from its browser origin or introduce a mutable current-store preference.
6. **Types and hooks:** imported source must meet the existing TypeScript and hooks rules.
   Adapt unsafe context assertions and hook patterns without disabling lint or weakening types.
7. **Assets:** capture confirms the original font loaded. Reuse only required fonts, avatar
   and notification assets. The starter animation does not create a holita Lottie requirement.
8. **Temporary mixed UI:** keep legacy form/table styles scoped to their pages. Check overlay
   stacking, focus restoration, scroll locking and Ant Design dialogs inside the MUI shell.
   Dark/preset review of the shell does not imply that legacy pages have been redesigned.

## Dependency decisions

Phase 3 installs the seven required direct dependencies below at the reference versions.
The excluded clsx candidate remains transitive where another package needs it.

| Package           | Reference version | Phase 3 decision                                                                                                                |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@mui/material`   | 9.4.0             | Installed: original shell components and theme system.                                                                          |
| `@emotion/react`  | 11.14.0           | Installed: MUI styling peer.                                                                                                    |
| `@emotion/styled` | 11.14.1           | Installed: MUI styling peer.                                                                                                    |
| `@emotion/cache`  | 11.14.0           | Installed: a shared CSSOM cache avoids per-rule development style elements and Ant Design's repeated head scans. No RTL plugin. |
| `@iconify/react`  | 6.0.2             | Installed: original icons with only the needed local icon data.                                                                 |
| `simplebar-react` | 3.3.2             | Installed: original scrolling behavior in the selected panels.                                                                  |
| `simplebar-core`  | 1.3.2             | Installed: the retained SimpleBar wrapper imports its option types.                                                             |
| `clsx`            | 2.1.1             | No direct dependency; explicit conditional class strings are sufficient.                                                        |

Reuse holita's existing React, React DOM, React Router and dayjs. The reference has React
Router 8.4.0 while holita has 7.18.3; copying the theme manifest would silently expand the
work into a router upgrade. Verify the selected APIs against holita's current router first.
No Refine MUI adapter is required just to host Refine hooks inside this shell.

Do not add these for the shell: Auth0/Firebase/JWT providers, axios/SWR, GSAP, ECharts,
FullCalendar, MUI X grids/date pickers, MUI Lab notification tabs, Lottie, i18next,
React Hook Form/Yup, extra rich-text libraries, map/file/chat/kanban packages, notistack or
RTL plugins. Stacked does not use the GSAP `SidenavCollapse` component; the top notification
popover does not use the full notification page's MUI Lab tabs. Some packages already exist
for real holita features; this list is not an instruction to remove those existing uses.

## Existing holita cleanup inventory

The shell markup and obsolete shell CSS were replaced in phase 3. The remaining protected
parts below stay until their explicit module migration. There is only one admin application.

| Existing part                                                                                                                                                                    | Action                                                                                 | Removal condition                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [AdminLayout](../../apps/admin/src/layout/admin-layout.tsx): existing header/sidebar/drawer markup, extracted from StoreWorkspace in phase 2                                     | Replaced with Aurora in phase 3.                                                       | New shell navigation, store selector, loading/error/unavailable states and mobile behavior work.                                      |
| `StoreWorkspace`: store discovery, URL-derived selection, Reference flag and subtree keys                                                                                        | Keep in application orchestration.                                                     | Not a cleanup target. Preserve original store and route mutation isolation.                                                           |
| [App](../../apps/admin/src/App.tsx): Refine, query client and routes                                                                                                             | Keep.                                                                                  | Not a cleanup target. No second router or cache.                                                                                      |
| `App`: Ant Design ConfigProvider/AntApp                                                                                                                                          | Temporarily retain where legacy content needs it; scope coexistence.                   | Last dependent legacy component and notification/dialog usage migrated.                                                               |
| [main.tsx](../../apps/admin/src/main.tsx): Ant Design reset                                                                                                                      | Audit against Aurora CssBaseline.                                                      | Reset can be narrowed/removed only after legacy and new UI remain correct; no blanket deletion at shell installation.                 |
| [app.css](../../apps/admin/src/app.css): `.app-layout`, `.app-header`, `.brand`, `.store-switcher`, `.app-content`, `.workspace-body`, `.app-sidebar` and associated media rules | Removed the old shell selectors in phase 3; added the explicit legacy content surface. | Corresponding elements are replaced and both desktop/mobile checks pass. Keep page-level content sizing explicit.                     |
| `app.css`: product editor, page headers, form errors, Event filters, Sessions, editor/gallery/history styles                                                                     | Keep until owning module migration.                                                    | Last owning legacy screen is replaced and behavior is verified.                                                                       |
| Product/Reference lists, editors, forms, relation selectors, field errors and unsaved-change dialogs                                                                             | Keep during shell stage.                                                               | Explicitly migrated module has equivalent working CRUD and focused checks.                                                            |
| [Data provider](../../apps/admin/src/data/data-provider.ts), feature provider mappings and GraphQL operations                                                                    | Keep the single provider and scoped lifecycle.                                         | Not a cleanup target. Phase 5 adds Product list filters to the existing contract and provider; persistence definitions are unchanged. |
| Ant Design package                                                                                                                                                               | Keep temporarily.                                                                      | No remaining production imports and legacy tests have been adapted to the migrated behavior.                                          |
| `apps/admin/public/images/tmp/avatar`: example profile and notification images                                                                                                   | Keep with the local demo data.                                                         | Real profile/notification assets replace every reference in `layout/demo-data.ts`.                                                    |
| Existing behavioral tests                                                                                                                                                        | Preserve coverage and adjust interaction selectors when UI changes.                    | Do not discard store/route/validation cases simply because Ant Design markup is replaced.                                             |

## Phase boundaries and acceptance

1. **Reference and inventory:** this artifact, original captures and consistent agent guidance.
   No application code or dependency changes.
2. **Small layout extraction:** separate visual composition from `StoreWorkspace` while
   retaining current presentation and behavior. No generic shell framework or editor rewrite.
3. **Aurora shell:** integrate the selected original shell and local demo menus, with holita
   navigation/branding and real store selection. Offer a usable local view after small increments.
4. **Integration review:** existing real CRUD works inside the shell. Compare desktop,
   collapsed/hover, menus and mobile against this reference; verify store/route boundaries.
   Obtain user acceptance before any module presentation migration.
5. **Modules:** Products first, then Venues/Speakers/Tags and Events with its child workflows.
   Remove each module's replaced components and dependencies only after its checks pass.

For the eventual shell acceptance, exercise keyboard open/close and focus return, narrow
320 px layout, responsive transitions around 900/1200 px, reload/history, unknown/empty
stores, Reference disabled mode, unsaved-change blocking, and pending writes during
store/editor navigation. Demo menu actions must not reset store, editor drafts or list queries.

## Validation mapping

- Phase 1: review changes and source links, validate edited skills and run `git diff --check`.
  Original-browser capture is visual reference collection, not application test execution.
- Extraction: `npm run test:admin -- store-workspace.test.tsx` and relevant Reference
  workspace/navigation cases; use the shared-navigation browser checks below.
- Shared shell integration: `npm run test:smoke -- aurora-shell.smoke.spec.mts products.smoke.spec.mts reference-layout.smoke.spec.mts reference-disabled.smoke.spec.mts`.
  These use the existing guarded dedicated test databases and owned processes described
  in [testing](../../docs/testing.md). Source screenshots are not a substitute.
- Adding UI packages changes workspace dependency inputs: run root `npm run lint`,
  `npm run typecheck` and `npm run build`, plus the focused behavioral checks.
- CRUD migration: add the owning module's existing form/editor/list/lifecycle cases.
  Schema/codegen and database checks become necessary only if their contracts are changed.
- No automatic `test:full`; report executed counts and unverified behavior. Keep individual
  run results in the task response rather than updating product docs as a test journal.

README and product documentation describe the implemented Aurora/MUI shell and all CRUD workflows,
including Events and its child screens. Ant Design has been removed. CLAUDE.md imports
AGENTS.md without a duplicate migration policy.
