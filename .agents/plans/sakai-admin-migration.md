# Sakai Angular admin migration plan

This is the user-requested migration planning artifact. The completed batches below retain
their original evidence as historical task context. Current product behavior belongs in
the authoritative documentation; pre-retirement React source remains in Git history.

The final application is Angular with holita branding and Sakai presentation, retaining the
required business and Prototype capabilities. The pinned
[Sakai source](../../docs/development.md#sakai-source-reference) supplies visual composition.
The migration used React as historical evidence for contracts, validation and scoped lifecycles.

## Implemented batches

**M1 / phase 8 — Reference boundary and Venues: complete.** Angular now provides
availability-gated Venues navigation/routes, scoped generated Apollo operations, server list
queries, typed create/edit forms and referenced-aware sequential deletion. Current usage,
architecture, validation and contributor guidance have been updated.
At this historical checkpoint React remained the behavior reference for later batches.

Validation evidence:

- `VITEST_MAX_WORKERS=2 npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --include="app/features/products/*.spec.ts" --include=app/features/stores/store-workspace.spec.ts --include=app/core/config/admin-config.spec.ts --skip-nx-cache`: 109 passed across 12 files. The unconstrained combined run exceeded deadlines on this host; bounded workers passed without changing deadlines or case selection.
- `npm run test:schema -- contracts.unit.spec.mts`: 3 passed; codegen and schema:check passed with the explicit new operation input.
- `angular-venues.smoke.spec.mts`: all 12 distinct cases passed across the initial run and focused corrected-case reruns. The initial run passed seven business cases; filter/backend-disabled cases passed in the next selection; mobile/disabled-route cases passed after fixing selectors; the delayed-module case passed separately. These are executed real-fixture results, not a claim that the first full invocation was green.
- Focused `angular-foundation` A → B → A plus `angular-shell` desktop/mobile navigation cases: 3 passed, including the new Venue link in focus-trapping assertions. Browser selectors remained native Playwright `--grep` selections through `test:smoke:admin`.
- Root `npm run lint`, `npm run typecheck` and `npm run build` passed. The final new browser case also passed focused ESLint and `typecheck:tools`.
- Prettier checks passed for changed Angular code, tooling, docs and skills; diff whitespace and 389 existing local documentation links passed. Global `format:check` still reports formatting differences in 120 untouched React/backend/tool files; no unrelated rewrite was included.
- Compared Sakai with Venues list/editor at 1280×800, 390×844 and 320×800 in light/dark. Twelve captures show 28px card padding, local Lato and no page overflow/runtime errors. Theme captures use the actual toggle so PrimeNG's color scheme matches the shell. Captures are ignored under `.references/review/phase-8/` and are not product-documentation dependencies.

PrimeNG MCP tools were unavailable in this session. New Textarea/ToggleSwitch APIs were
checked against official documentation and installed declarations, then compiled and exercised
in the browser; no MCP usage validation result is claimed.

**M2 / phase 9 — Speakers and Tags: complete.** Both resources now have availability-gated
navigation/routes, concrete generated-operation Apollo services, URL-backed lists, typed
editors and sequential deletion with failed-row retry. Speaker optional fields clear to null;
Tags validate/preview/lowercase HEX colors and focus duplicate Name errors. Shared Reference
SCSS supplies presentation only. Store switching preserves each section; resource/mode/ID
keys and captured clients retire reads, submitted writes and editor callbacks correctly.
Authoritative usage, architecture, requirements, tests and contributor guidance are current.

Validation evidence:

- `VITEST_MAX_WORKERS=2 npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --include="app/features/products/*.spec.ts" --include=app/features/stores/store-workspace.spec.ts --include=app/core/config/admin-config.spec.ts --skip-nx-cache`: 205 passed across 22 files. The earlier new-feature/boundary selection passed 97 cases; the final selection additionally covers exact text limits and Products/Venues regressions.
- `npm run codegen`, `npm run schema:check` and `npm run test:schema -- contracts.unit.spec.mts` passed; the contract suite executed 3 cases and checks 15 explicit operation input files.
- `npm run test:smoke:admin -- angular-lookups.smoke.spec.mts`: 13 passed initially. Two CRUD tests reloaded the editor before save navigation completed; their expectations were corrected to await the list URL and confirmed deletion before reload. No application change was needed for those failures.
- `npm run test:smoke:admin -- angular-lookups.smoke.spec.mts angular-shell.smoke.spec.mts angular-venues.smoke.spec.mts --grep="CRUD|Sakai desktop navigation|mobile drawer traps|real Venue create"`: 5 passed, including both corrected CRUD cases and 3 regressions. All 15 distinct new lookup cases and 3 regression cases have executed successfully; the initial full invocation was not green.
- Real browser cases prove null clearing/false persistence, Email null-last/Color sorting and stable ties, focused duplicate Tag Name errors, referenced deletion retained through trashed Events, partial retry, delayed A → B → A reads/writes, dirty navigation and disabled Reference. The updated mobile shell focus order includes both new links.
- Root `npm run lint`, `npm run typecheck` and `npm run build` passed. Focused final ESLint and `npm run typecheck:tools` passed; the final browser target rebuilt Angular after the Tag hint correction. Changed-file Prettier and diff whitespace checks passed; 405 documentation links resolve.
- Compared the pinned Sakai CRUD/Form Layout captures with both resources at 1280×800, 390×844 and 320×800 in light/dark. The 24 local captures show Lato, 28px card padding, zero page overflow and zero runtime errors. Reviewed the email/biography controls, color preview, narrow Bulgarian labels and table scrolling. Corrected Tag Name guidance from 200 to 100 and refreshed the affected form captures. Captures remain ignored in `.references/review/phase-9/`; product documentation does not depend on them.

PrimeNG MCP tools remained unavailable. Existing controls follow the
[official InputText documentation](https://primeng.dev/inputtext) and installed declarations,
with Angular compilation and actual PrimeNG/browser checks; no MCP usage validation is claimed.

**M3 / phase 10 — Events, relations, rich description and overview: complete.** Angular
now provides generated Event list/detail/create/update operations, URL-backed filters/ranges/
sorting/paging, per-store columns, remote Venue/Tag choices, a typed sectioned editor and saved
overview. Exact EUR strings, Sofia instants/DST, registration calendar dates, null clearing,
immutable Code and captured-client/route lifecycles are preserved. Event-owned Tiptap core
supplies bounded sanitized rich text. Sakai cards, Accordion, settings aside and relation
dialogs use Bulgarian/English labels and local date formatting. Authoritative product and
contributor documentation describes this implementation. Lifecycle/bulk/Trash/History,
Sessions, Gallery and Prototype remain outside this batch.

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --include="app/features/products/*.spec.ts" --include=app/features/stores/store-workspace.spec.ts --include=app/core/config/admin-config.spec.ts --skip-nx-cache`: 244 passed across 26 files. The earlier 243-case selection passed with two workers. After adding locale coverage, a concurrent root-check run exceeded a first Tag test deadline; the complete selection passed with one worker after root checks finished. No case was removed or deadline increased. New Event editor setup precompiles its route components in `beforeEach` so cold component compilation is outside the first behavioral case.
- `npm run codegen`, `npm run schema:check` and `npm run test:schema -- contracts.unit.spec.mts` passed. The contract suite executed 3 cases and checks 16 explicit operation input files.
- `npm run test:smoke:admin -- angular-events.smoke.spec.mts`: 9 passed in one full invocation. An earlier combined invocation passed eight of eleven cases; failures were test selectors for the seeded `The Glasshouse` name and the paginator's `Page 2` accessible name. Corrected selectors preceded the green full run; no application workaround was added.
- `npm run test:smoke:admin -- angular-events.smoke.spec.mts angular-shell.smoke.spec.mts --grep="Event CRUD|Event list keeps|Sakai Event|Sakai desktop navigation|mobile drawer traps"`: 5 passed after local date labels and overview action spacing changed. The final `angular-events.smoke.spec.mts --grep="Sakai Event"` selection passed after narrow relation controls were improved and list captures awaited completed reads. Both invocations rebuilt Angular and used dedicated real-fixture schemas.
- Real browser cases prove every editable field surviving save/reload, exact maximum EUR, explicit clearing/false, remote paging/inactive hydration/retry, URL history/ranges/columns, rich paste/formatting/links/undo/redo/byte limits, dirty navigation, disabled routes and delayed store reads/submitted writes. Shell regressions include the implemented Events navigation link.
- Root `npm run lint`, `npm run typecheck` and `npm run build` passed for all six applications. The final presentation-only changes were subsequently compiled and exercised through the browser target. Changed-file formatting, whitespace and local documentation link checks passed; the existing unrelated global formatting baseline was not rewritten.
- Compared the pinned Sakai CRUD/Form Layout with populated Event list/editor/overview/open lookup at 1280×800, 390×844 and 320×800 in light/dark. Reviewed all form sections, the rich toolbar/content, long Bulgarian labels, action spacing, table scrolling and popup focus. Moved advanced filters into an Accordion, kept status labels unbroken and placed relation clearing below the value on mobile. The final 24 captures have no page overflow or runtime errors and remain ignored under `.references/review/phase-10/`.
- Read-only localhost checks additionally confirm local Lato, 28px card padding, clean list/editor/overview loading and narrow/mobile dark rendering with the existing development configuration. Development records were not changed. Fixture captures contain PrimeNG's standard missing-license notice; the notice was not hidden or bypassed, and the local license configuration was preserved.

PrimeNG MCP remained unavailable. Dialog/Listbox/Accordion/Select usage was checked against
official component documentation and installed PrimeNG 22.1.2 declarations, then compiled
and exercised in the browser; no MCP usage validation result is claimed. Tiptap APIs were
checked against official editor documentation and installed 3.31.3 declarations. Its core,
StarterKit/PM, DOMPurify and Day.js versions reuse the existing workspace lockfile; Angular
does not depend on React's implementation or adapter.

**M4 / phase 11 — Status actions, Trash/Restore and History: complete.** Angular now
provides Active/Trash URL state, page-local selection and confirmed atomic Publish/Archive/
Trash/Restore through its own generated documents and captured EventsApi client. Rejected
selections remain available for retry; query changes retire the confirmation. Overview actions
refresh saved details and History; Trash is read-only with Restore and reserved Code/children.
History uses native PrimeNG Tabs/Table/Paginator, cancellable server pages of 20, localized
labels/Anonymous/Sofia offsets and expanded plain-text values. Description excerpts are
sanitized before text extraction. Native SVG PrimeIcons supply visible named row controls.
Cancel/Escape restores the trigger; successful actions focus the current heading. Empty lists
cannot select a page. Existing backend contracts and persistence are unchanged. Sessions,
Gallery and Prototype controls remain outside this batch.

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --include="app/features/products/*.spec.ts" --include=app/features/stores/store-workspace.spec.ts --include=app/core/config/admin-config.spec.ts --skip-nx-cache`: 253 passed across 28 files. An earlier Event-only invocation exposed jsdom's missing ResizeObserver after native Tabs were added; the Event route fixture now stubs that browser API and the complete selection passed. The focused final `events/*.spec.ts` selection passed 41 cases. After the empty-header guard, `events/events-api.spec.ts` passed 8 cases and `admin:build --skip-nx-cache` passed without unused-component warnings.
- `npm run codegen` and `npm run schema:check` passed; all local operations validate against the composing subgraphs. Existing operation input registration remains at 16 files. Backend SDL, migrations and implementation were not changed.
- `npm run test:smoke:admin -- angular-lifecycle.smoke.spec.mts angular-events.smoke.spec.mts --grep="atomic|ineligible|History has|delayed bulk|Sakai lifecycle|Event CRUD|Event list keeps"`: 8 functional cases passed; the visual case correctly failed while the compiled Eye control still used an unloaded font icon. The final `npm run test:smoke:admin -- angular-lifecycle.smoke.spec.mts --grep="Sakai lifecycle"` rebuilt Angular and passed after the SVG correction. All 7 lifecycle cases and 2 Event regressions have executed successfully; the initial combined invocation was not green.
- Earlier fixture issues used an incorrect Session mutation signature and an ambiguous History cell selector. These were corrected against the actual SDL and accessible name. The real cases then prove whole-batch rollback for changed eligibility/foreign/missing IDs, retained retry, status/Trash/Restore reload, reserved Code and retained Sessions, blocked child reads in Trash, empty/paginated History, HTML excerpts, failed-read retry, duplicate-write suppression and late A → B → A/query completion isolation. Last-page correction, row and selected Restore, native Tab keyboard operation and dialog focus are covered.
- Root `npm run lint`, `npm run typecheck` (all six applications and tools) and `npm run build` passed. Final focused Event/browser ESLint, uncached Angular typecheck and production compilation passed after SVG changes. Initial lint findings were corrected without suppressions. Changed-file formatting, whitespace and documentation targets were checked; product documentation records current behavior rather than test-run journals.
- Compared the pinned Sakai CRUD/Form Layout with lifecycle selection/dialog/History/Trash at 1280×800, 390×844 and 320×800 in light/dark. Removed nested History padding, kept Code readable and used native circular SVG action buttons with accessible names. The 24 final fixture captures have no page overflow or runtime errors and remain ignored under `.references/review/phase-11/`. Read-only localhost checks confirm visible 16px Eye/Trash SVGs and the real empty History state without changing development records. Fixture captures preserve PrimeNG's standard missing-license notice; it was not hidden or bypassed, and the private local license configuration was preserved.

PrimeNG MCP remained unavailable. Native Dialog/Table/Checkbox/Tabs/Button and SVG icon APIs
were checked against official component documentation and the installed PrimeNG 22.1.2 and
PrimeIcons declarations, then compiled and exercised in Chromium. No MCP usage-validation
result is claimed.

**M5 / phase 12 — Sessions, program ordering and speaker summaries: complete.** Angular
now provides Event-scoped generated Session CRUD and complete-set ordering through a captured
store/language/parent Apollo client. Typed child editors preserve Sofia bounds/exact instants,
plain Summary/Room, explicit nullable clearing and remote Speaker hydration with inactive
labels. Saved program rows and local order drafts remain separate; native drag/buttons,
announcements, confirmed permanent deletion and failed-save/reload retry follow Sakai.
Dirty tab/route/unload guards retain the mounted program when navigation is rejected. The
parent observes successful writes in its own scope, refreshing Event/History even after a
pending program write outlives its tab. New parent/store/editor scopes receive no obsolete
callbacks. The overview deduplicates Speakers; Trash blocks child reads and Restore returns
the retained program. Authoritative documentation, requirements and contributor guidance
now describe this behavior. Gallery/uploads and Prototype remain later batches.

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --include="app/features/products/*.spec.ts" --include=app/features/stores/store-workspace.spec.ts --include=app/core/config/admin-config.spec.ts --skip-nx-cache`: 269 passed across 31 files before the final Session regression and tab-notification change. The final `VITEST_MAX_WORKERS=1 npm run test:admin -- --include="app/features/reference/sessions/*.spec.ts" --skip-nx-cache` passed 17 cases across 3 files, including changed-membership matching-prefix retention and retirement of saved-change notifications. These are separate executed selections, not a claim of a final combined 270-case run.
- `npm run codegen`, `npm run schema:check` and `npm run test:schema -- contracts.unit.spec.mts` passed. The contract suite executed 3 cases and checks 17 explicit operation input files, including Angular-owned Sessions. Backend SDL, migrations and implementation are unchanged.
- The first browser invocation exposed an actual optimistic Tabs visibility defect and mismatched accessible-name selectors; it was stopped to correct them. A later `npm run test:smoke:admin -- angular-sessions.smoke.spec.mts angular-lifecycle.smoke.spec.mts angular-events.smoke.spec.mts --grep="Session|program drag|atomic lifecycle|Event CRUD|Event list keeps"` executed 14 cases: 13 passed, and one failed because the expected History label was wrong. The selector now matches the implemented `Sessions reordered` label. Event CRUD/list and atomic lifecycle regressions passed in that selection.
- Final `npm run test:smoke:admin -- angular-sessions.smoke.spec.mts`: all 12 cases passed in one invocation against dedicated real-fixture schemas. These prove create/edit/reload/delete, plain-text rendering/null clearing, protected Event dates, remote Speaker paging/inactive hydration/retry, drag/buttons/save/cancel/complete-set conflicts, dirty tabs, History, Trash/Restore, disabled routes and delayed parent/editor/store A → B → A. A gated write completing after program → History navigation refreshes the current History without leaving its tab.
- Root `npm run lint`, `npm run typecheck` (six applications and tools) and `npm run build` passed. After the final scoped notification/presentation changes, focused Session/Event-overview/browser ESLint, `npm run typecheck:tools`, uncached `admin:typecheck` and production compilation through the real browser target passed. Lint findings were fixed without suppressions. Changed-file Prettier and diff whitespace checks passed; BG/EN catalogs have the same 376 keys and 513 local documentation targets resolve.
- Compared pinned Sakai CRUD/Form Layout with program rows, ordering drafts, permanent-delete Dialog, child editor, Speaker overlay and unique summary at 1280×800, 390×844 and 320×800 in light/dark. Corrected Speaker chip tokens and removed unrelated registration-date guidance from the Session aside. Final `npm run test:smoke:admin -- angular-sessions.smoke.spec.mts --grep="Sakai Session"` passed one case and refreshed all 36 captures with finite screenshot animations disabled, avoiding partially opened dialogs. Captures show local Lato, Sakai geometry, readable long Bulgarian labels and no page overflow/runtime errors. They remain ignored under `.references/review/phase-12/`; product documentation does not depend on them. Fixture captures retain the standard PrimeUI license notice, and the private development configuration was preserved.

PrimeNG MCP remained unavailable. Native Button/Dialog/Tabs APIs were checked against
[official Button](https://primeng.dev/button), [Dialog](https://primeng.dev/dialog) and
[Tabs](https://primeng.dev/tabs) documentation plus installed PrimeNG 22.1.2 declarations,
then compiled and exercised in Chromium. No MCP usage-validation result is claimed.

**M6 / phase 13 — Gallery, direct upload and previews: complete.** Angular now mounts
Event-scoped Gallery in the saved active editor and read-only overview. Its generated Media
operations and dedicated capability-only XHR implement intent → bytes → finalize with progress,
120-second transfer deadline and cancellation before finalization. Submitted writes retain
store/language/Event/client and retire obsolete feedback. Typed Alt text/null clearing, cover
fallback, confirmed removal, native drag/keyboard complete-set ordering, retained retry and
server-reloading Cancel preserve independent Event text drafts. Dirty Gallery work guards
navigation and blocks Event field submission. Previews support renewal, arrow keys/Escape/focus;
Trash blocks child reads and Restore retains images. Reference now accepts an explicit exact
`ADMIN_ORIGINS` allowlist with legacy single-origin fallback and both local admin defaults.
Documentation, requirements and contributor procedures describe implemented Angular Gallery.

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --include="app/features/products/*.spec.ts" --include=app/features/stores/store-workspace.spec.ts --include=app/core/config/admin-config.spec.ts --skip-nx-cache`: 276 passed across 32 files before the final error-message/diagnostic cleanup. Final `VITEST_MAX_WORKERS=1 npm run test:admin -- --include=app/features/reference/media/media-api.spec.ts --include=app/features/reference/events/event-editor.spec.ts --skip-nx-cache`: 13 passed across two files, including preserved GraphQL read diagnostics and seven Gallery cases. These are separately executed selections. Initial fixture compile errors and the editor's expected new Gallery reads were corrected; no unsafe casts or suppressions were added.
- `npm run codegen`, `npm run schema:check` and `npm run test:schema -- contracts.unit.spec.mts` passed. The contract suite executed three cases and checks 18 explicit operation input files, including Angular Media. Backend SDL, persistence, migrations and storage behavior were unchanged; the only backend runtime change is the upload origin configuration.
- `npm run test:reference -- admin-origins.spec.ts`: 11 passed, covering defaults, explicit precedence, legacy fallback and invalid origins. The real browser fixture explicitly supplies its ephemeral `ADMIN_ORIGINS`. A read-only local OPTIONS request confirms `Access-Control-Allow-Origin: http://localhost:11088`; the narrow ignored Reference environment override enables Angular uploads alongside React.
- The first `npm run test:smoke:admin -- angular-media.smoke.spec.mts` executed ten cases: six passed and four failed. It exposed an actual missing local file-validation message, an ambiguous warning/error selector, stale query expectations and a full-page test navigation that aborted the held response. The UI message and fixture behavior were corrected. The following `npm run test:smoke:admin -- angular-media.smoke.spec.mts angular-events.smoke.spec.mts angular-lifecycle.smoke.spec.mts angular-sessions.smoke.spec.mts --grep="angular-media|Event CRUD|atomic lifecycle|Session CRUD"` executed 14 cases: 13 passed; only a stale query assertion remained in the A → B → A case.
- Final `npm run test:smoke:admin -- angular-media.smoke.spec.mts angular-sessions.smoke.spec.mts --grep="submitted finalization|rejects invalid|Sakai Gallery|Session CRUD"`: all five cases passed after the assertion, diagnostic and presentation fixes. All 11 distinct Gallery cases and three Event/lifecycle/Session regressions have executed successfully across the corrected selections; this is not a claim of one final 14-case invocation. Real-fixture cases prove persisted bytes/Alt null clearing/cover/order/removal/History, independent text drafts, native drag, atomic changed-membership conflicts/retry, corrupt files/size/MIME/ten-image limits, canceled unfinished bytes, captured store/Event finalization, renewed broken previews, Trash/Restore and disabled routes without Media operations.
- Root `npm run lint`, `npm run typecheck` (all six applications and tools) and `npm run build` passed. After the final frontend changes, focused Media/Event-overview/browser ESLint, `npm run typecheck:tools`, uncached `admin:typecheck` and production compilation through the real browser target passed. Changed-file Prettier and diff whitespace checks passed. BG/EN catalogs have the same 423 keys; 462 product/contributor documentation file targets resolve.
- Compared pinned Sakai CRUD/Form Layout geometry and File/Media source composition with Gallery cards, upload progress, order drafts, Alt/removal Dialogs and previews at 1280×800, 390×844 and 320×800 in light/dark. Kept embedded Gallery free of nested card padding, wrapped long Bulgarian actions and separated the image count from the heading. Finite screenshot animations are disabled and full-page captures start at the top, preserving the actual fixed header/aside positions. All 36 final captures have no page overflow/runtime errors and remain ignored under `.references/review/phase-13/`. Fixture captures retain PrimeUI's standard missing-license notice; private development configuration was preserved. Product documentation does not depend on the captures.

PrimeNG MCP remained unavailable. Native Dialog/InputText/ProgressBar APIs were checked against
[official Dialog](https://primeng.dev/dialog), [ProgressBar](https://primeng.dev/progressbar),
[Angular HTTP](https://angular.dev/guide/http/making-requests) and installed PrimeNG 22.1.2
declarations, then compiled and exercised in Chromium. No MCP usage-validation result is claimed.

**M7 / phase 14 — Angular Prototype startup, persistence and basic resources: complete.**
Angular defaults to Real and selects Prototype once through its standard CLI environment
replacement or served runtime configuration. MSW starts before bootstrap, forces the admin
origin's `/__prototype/graphql` and accepts only POST with the 21 generated Angular basic
operation documents, including Apollo's typename transformation. A final HTTP handler rejects
other business endpoints and off-origin requests. Stores/Products/Venues/Speakers/Tags reuse
their existing screens and concrete Apollo services, with Angular-owned mock modules and no
React implementation imports. A disposable, validated localStorage snapshot preserves concrete
validation, nullable updates, query rules and reserved active/trashed Event/Session deletion links.
Localized mode display and confirmed Reset preserve locale/appearance, drain submitted writes
from active and retired clients, replace both stores' fixtures and bootstrap fresh clients/forms.
Storage failures retain the prior snapshot and allow retry. Root `dev:admin:mock` now starts
Angular at port 11089; the standard compiled fixture can run without backend/database processes.
Product documentation, requirements and contributor procedures describe this implemented scope.
Events, Sessions, Gallery, History and the UI catalog remain unavailable in Angular Prototype.

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --skip-nx-cache`: 298 passed across 36 files. The first full invocation passed 297 and failed the existing disabled-Events availability assertion: the new guard redirected Real as well as Prototype. Restricting that guard to Prototype preserved Real's unavailable state, and the complete rerun passed. The earlier focused config/state/transport/write-tracker selection passed 28 cases in four files.
- `npm run test:smoke:admin -- angular-prototype.smoke.spec.mts`: all nine cases passed in one complete invocation. An initial attempt was interrupted after missing mock response typenames prevented Apollo fragment hydration. The first completed invocation passed four and failed five due to premature edit reloads and checking appearance before bootstrap. Corrected navigation/theme waits preceded another interrupted attempt that exposed a debounce/query-change confirmation race in the test; final CRUD checks wait for applied URL filters and settled reads. No timeout was increased to hide these failures.
- Final `npm run test:smoke:admin -- angular-prototype.smoke.spec.mts angular-foundation.smoke.spec.mts angular-shell.smoke.spec.mts angular-lookups.smoke.spec.mts angular-venues.smoke.spec.mts --grep="accepts only exact Angular|Sakai Prototype screens|compiled Angular discovers stores|Sakai desktop navigation|mobile drawer traps|Speaker CRUD|Tag CRUD|direct Venue routes"`: all eight cases passed. This rebuilt the final HTTP guard and proves rejected GET/altered/foreign documents and both same-origin and off-origin Gateway refusal against successful-response network traps. It also verifies actual Real Stores/Products A → B → A, Speaker/Tag CRUD, desktop/mobile keyboard/theme navigation and disabled Reference routes with dedicated fixture schemas.
- Backend-free cases prove each basic CRUD/reload, A → B → A, missing scope, startup/write/Reset storage errors, retained drafts/retry, confirmed Bulgarian/appearance preservation and delayed retired-write Reset without record revival. State tests cover normalized fields, null clearing, literal search, filters/sort/page/stable ties, uniqueness, reserved links, invalid/obsolete/cross-store snapshots and failed-write preservation. Real Apollo unit submissions prove draining successful and rejected retired-client mutations while blocking new writes.
- Root `npm run lint`, `npm run typecheck`, `npm run build` and `npm run schema:check` passed. Final handler/browser ESLint and `npm run typecheck:tools` passed; the final browser target compiled the updated Angular source. SDL and operation inputs are unchanged. The production initial bundle is 729.11 kB: it remains below the 1 MB error budget but exceeds the existing 700 kB warning budget by 29.11 kB. Validator uses ESM imports; no new CommonJS warning or budget increase was introduced.
- Changed-file Prettier and diff whitespace checks passed. BG/EN catalogs contain the same 433 keys; 481 product/contributor documentation file targets resolve. The unrelated private development config and prior-phase working changes were preserved.
- Compared pinned Sakai CRUD/Form Layout and corresponding Real screens with Prototype lists/editors and Reset at 1280×800, 390×844 and 320×800 in light/dark. Reviewed Lato, 28px card padding, mode/store selector, wrapped Bulgarian controls, table scrolling and narrow dialogs. All 54 final captures have no page overflow/runtime errors and remain Git-ignored under `.references/review/phase-14/`. Fixture captures retain PrimeUI's standard missing-license notice; product documentation does not depend on them.
- Started `npm run dev:admin:mock` and checked `http://localhost:11089/bg` through a separate browser context: Prototype indicator, both stores and populated Products use only `/__prototype/graphql`, with local Lato, zero runtime errors and no license notice. The existing 11088 process still serves its pre-M7 in-memory shell and needs the normal shared dev restart for the new mode indicator; its Stores reads and license still work. Its concurrently-owned service processes were preserved. Fresh compiled Real behavior is covered by the six passing regression cases above.

PrimeNG MCP remained unavailable. Native Dialog/Tag APIs were checked against
[official Dialog documentation](https://primeng.dev/dialog) and installed PrimeNG 22.1.2
declarations, then compiled and exercised in Chromium. Standard environment replacement follows
[Angular CLI environments](https://angular.dev/tools/cli/environments). MSW behavior was
verified against the installed 3.0.1 public declarations/source and actual service-worker
requests; custom unhandled-frame logging is not used as a blocking mechanism. No MCP
usage-validation result is claimed.

**M8 / phase 15 — Prototype Events, Sessions, Media and History: complete.** Angular's
existing Sakai components and concrete Apollo services now support all implemented business
workflows in both modes. The Angular-owned mock transport accepts 42 generated documents;
Events, Sessions, atomic lifecycle actions and paged History use current scoped relations,
exact EUR strings, Sofia instants, typed editors and complete ordering sets. Snapshot version 2
replaces the earlier disposable basic dataset and commits mutations/History together.
Media follows intent → binary → finalize, stores finalized Blobs in native IndexedDB before
metadata and rechecks snapshot/capability identity after asynchronous writes and reads.
Reset drains captured submissions, replaces fixtures/clients/forms and prunes image bytes;
Trash/Restore retain children and files. Unfinished uploads remain ephemeral. The existing
Real availability gate is preserved; Prototype enables the newly implemented modules.
Documentation, requirements, attribution and contributor procedures describe this scope.

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --include=app/mocks/events.spec.ts --include=app/mocks/media.spec.ts --include=app/mocks/state.spec.ts --skip-nx-cache`: 57 passed across three files. Concrete cases cover conditional validation/current and inactive relations, atomic rollback, History, Session limits/complete ordering, storage failures/retry, idempotent finalization, expiry/renewal, Reset/Trash and canceled decoding races. Media reads now revalidate retired/expired capabilities after awaiting bytes.
- Final `VITEST_MAX_WORKERS=1 npm run test:admin -- --skip-nx-cache`: all 354 tests passed across 39 files. This includes existing Angular API/editor/store/route behavior and the new mock rules.
- Final `npm run test:smoke:admin -- angular-prototype.smoke.spec.mts angular-prototype-events.smoke.spec.mts angular-prototype-media.smoke.spec.mts`: all 17 cases passed in one invocation. The fixture starts no backend or database and proves basic/rich CRUD, exact document/origin rejection, reload persistence, native IndexedDB write failure/retry, independent Event drafts, cover/Alt/null/order/removal, preview arrows/Escape/focus, atomic lifecycle, read-only Trash/Restore, paged History, delayed A → B → A and Reset draining retired Event/Media writes. Navigation before a held upload intent completes prevents binary/finalization. Decoder cancellation and post-await Reset/Trash/read races are covered separately by controlled unit cases.
- Earlier rich browser attempts exposed incorrect saved-editor navigation, accessible-name/empty-row expectations and a preview assertion made before the order mutation settled. The tests now wait for actual saves/bootstrap and use the implemented names. The same completed-order wait was added to the existing Real Gallery test. No deadline was increased.
- `npm run test:smoke:admin -- angular-events.smoke.spec.mts angular-sessions.smoke.spec.mts angular-media.smoke.spec.mts --grep="Event CRUD saves|Session CRUD persists|gallery saves bytes|blocks Event list|blocks saved editor"`: all five Real regression cases passed against dedicated fixture schemas, covering Event/Session/Gallery persistence and disabled routes without forbidden business requests.
- Root `npm run lint`, `npm run typecheck` (all six applications and tools) and `npm run build` passed. Angular production compilation also ran through both browser invocations. SDL, operation inputs and dependencies are unchanged. The current initial Angular bundle is 664.21 kB, below its existing warning/error budgets; Prototype transport remains lazy-loaded.
- Changed-file Prettier and diff whitespace checks passed. BG/EN catalogs have the same 435 keys; 493 product/contributor documentation file targets resolve. The prior-phase working changes and private development configuration were preserved.
- Compared pinned Sakai CRUD/Form Layout and corresponding Real Gallery composition with populated Prototype Events, program, Gallery and Alt Dialog at 1280×800, 390×844 and 320×800 in light/dark. Reviewed local Lato, 28px card padding, stacked narrow forms/actions, table scrolling and dialog focus. All 24 phase-15 captures have no page overflow/runtime errors and remain ignored under `.references/review/phase-15/`. The combined run also refreshes the basic Prototype/Shell/Reset captures. Fixture captures retain PrimeUI's standard missing-license notice; product documentation does not depend on captures.
- Checked the existing development process at `http://localhost:11089/bg` in a separate browser context: the fixture Event loads three Sessions, one History entry and two decoded 1200px images, with Lato/28px cards, zero runtime errors and all business POST requests on `/__prototype/graphql`. The development processes were preserved, and task-started browser/fixture processes were closed.

No new PrimeNG component API was introduced. Runtime keyboard/focus checks use the existing
Dialog/buttons. PrimeNG MCP tools were unavailable; no MCP usage-validation result is claimed.
Prototype evidence does not establish cross-tab coordination, Sharp decoder parity or service
persistence. The UI catalog and React retirement remain later batches.

**M9 / phase 16 — Sakai UI catalog: complete.** Angular Prototype now provides a lazy,
store-discovery-gated catalog with Body, Lists, Forms and States sections. Native PrimeNG
components follow the pinned Sakai composition; only the active section is mounted. Examples
own their local rows/forms/feedback and reset on section, store, language, reload and Reset.
The selected tab uses URL query state; store switching returns to Body. Catalog actions do
not issue business operations or write persisted Prototype data. Real rejects the route
before loading the examples and hides its navigation. The shell receives an explicit
Prototype input rather than querying feature services. No dependencies or API contracts changed.
Authoritative documentation, requirements and contributor procedures describe this scope.

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --include="app/features/prototype/ui-catalog/*.spec.ts" --skip-nx-cache`: all nine cases passed across two files, including the final repeat after strict lint corrections. Cases cover page-local selection, stable sorting, deletion from the last page, typed form limits/reset/pending state, local retry/confirmation, section remounting, unavailable stores and Real route rejection. The initial test fixture needed a local ResizeObserver stub for jsdom; no application workaround or deadline change was added.
- `VITEST_MAX_WORKERS=1 npm run test:admin -- --skip-nx-cache`: all 363 tests passed across 41 files before the final equivalent validator callback wrappers and typography correction; the affected nine cases were repeated afterward as above.
- `npm run test:smoke:admin -- angular-ui-catalog.smoke.spec.mts angular-foundation.smoke.spec.mts angular-shell.smoke.spec.mts`: all 15 cases passed in one invocation, including the eight existing Real foundation/shell regressions. The final `npm run test:smoke:admin -- angular-ui-catalog.smoke.spec.mts` repeat passed all seven catalog cases and refreshed the captures after the final code/style corrections. Its six Prototype cases start no backend; its Real boundary case uses the existing dedicated-schema fixture.
- Browser cases prove local create/edit/confirmed deletion, filters/paging/sorting and selection retirement, first-error focus, failed/pending draft retention, A → B → A/language/reload/history resets, retry/retained data, Escape/focus restoration and mobile catalog navigation. Persisted Prototype data remains byte-for-byte unchanged during local examples. Catalog requests are limited to surrounding Stores discovery, and Real never loads its lazy component or requests a CRUD resource.
- The first browser run exposed an initially unnamed native Table header checkbox and a test interacting with a closing Select overlay. A native label now names the checkbox from first paint; the test waits for actual overlay detachment. PrimeNG DatePicker translations were corrected to the installed API's root fields. The complete corrected selection passed without increasing deadlines or suppressing checks.
- Root `npm run lint`, `npm run typecheck` and `npm run build` passed. Strict lint findings were repaired using explicit void callbacks, safe unknown narrowing and validator wrappers. No suppressions were added. Angular's current initial production bundle is 689.65 kB, within the existing budgets; the catalog is a separate lazy chunk.
- Changed-file Prettier and diff whitespace checks passed. BG/EN catalogs share all 559 keys; 538 product/contributor documentation file targets resolve. Earlier-phase changes and private development configuration were preserved.
- Compared pinned Sakai Form Layout and typography/button/card source with all four sections and confirmation dialogs at 1280×800, 390×844 and 320×800 in light/dark. Corrected nested tab padding, doubled heading spacing, stretched aside status and heading sample weight/line height. The 30 final fixture captures have no page overflow/runtime errors and remain ignored under `.references/review/phase-16/`. Fixture captures retain PrimeUI's standard missing-license notice; product documentation does not depend on them.
- Checked the existing development process at `http://localhost:11089/bg/stores/10000000-0000-4000-8000-000000000001/ui-catalog` in a separate browser context. Forms use local Lato/28px cards; the Bulgarian calendar stays within 320px with localized month/navigation labels, no page overflow and no runtime errors. Development processes were preserved; task-started browsers and fixture processes were closed.

PrimeNG MCP tools remained unavailable. Native APIs were checked against installed PrimeNG
22.1.2 declarations/source and official [Tabs](https://primeng.dev/tabs),
[Table](https://primeng.dev/table), [Select](https://primeng.dev/select),
[Dialog](https://primeng.dev/dialog), [Menu](https://primeng.dev/menu),
[DatePicker](https://primeng.dev/datepicker) and [Skeleton](https://primeng.dev/skeleton)
documentation, then compiled and exercised in Chromium. Multiple choice uses Select's
supported multiple mode. No MCP usage-validation result is claimed. Local catalog examples
do not establish backend validation or persistence parity.

**M10 / phase 17 — parity audit and cleanup before retirement: complete.**
The source review maps React's implemented capabilities to Angular-owned components,
concrete generated Apollo services and native Angular checks. No React implementation is
imported by Angular. Sakai remains the presentation reference; parity concerns domain
behavior and request/store/route ownership rather than Aurora wrappers or filenames.

The operation review compares parsed root fields, variable declarations/defaults and output
selections in all eight operation files per application. Angular has 42 operations against
React's 43. The sole missing root is `deleteReferenceEvent`: Angular uses the backend's
atomic `trashReferenceEvents` for both one record and 1–100 explicit page-local IDs.
This preserves the requested Event rules without adding sequential deletion. Product
timestamps are not displayed by either UI, and Angular receives the discovered Store through
its workspace input instead of requesting the unused nested Product Store fields.
Corresponding operation variable contracts match; Reference result selections retain all
used fields. The generator and contract-tool checks include all 18 explicit workspace inputs.

The audit removed the temporary `eventsEnabled` flag, which had become identical to
`referenceEnabled`, across configuration/workspace/shell/navigation. It corrected localized
startup failure semantics (`role=alert` and document language), Event fields compressed by
the desktop settings aside at 992px, duplicate Accordion/card horizontal padding, unbroken
Event/Tag labels expanding the overview, narrow Product statuses/actions splitting into letters
and Reference status labels breaking mid-word. The shared page-heading text constraint also
keeps a valid unbroken parent Event title within the Session editor breadcrumb.
Overview actions wrap below the title when their combined width does not fit. Schema-tool
module discovery now excludes ignored temporary/source-reference directories rather than
indexing their unrelated packages. No dependency, backend API, persistence or migration changed.

Applicable React-only semantic coverage was transferred: failed parent Event background
refresh must retain the mounted Session program and its unsaved order; blocked native
IndexedDB must stop Prototype startup without Gateway requests; JPEG/WebP bytes survive
reload, and a truncated PNG adds neither Media nor History. Responsive coverage also saves
valid unbroken Event/Tag names and retains dirty Event fields through 991/992px resizing.
Existing Prototype visual selectors now address the mode indicator inside the banner,
because the implemented catalog adds a second Prototype navigation caption.

| Capability                                                                                                                                                      | Native Angular coverage                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stores, shell, keyboard/mobile navigation, locale/theme and responsive draft preservation                                                                       | `store-workspace.spec.ts`, `appearance.spec.ts`, `admin-config.spec.ts`; [foundation](../../tools/browser/angular-foundation.smoke.spec.mts), [shell](../../tools/browser/angular-shell.smoke.spec.mts), [combined parity](../../tools/browser/angular-parity.smoke.spec.mts).                                                                                                                                    |
| Product CRUD, URL filters/sort/history, sequential partial deletion/retry and captured writes                                                                   | `products/*.spec.ts`; [list](../../tools/browser/angular-products-list.smoke.spec.mts), [editor](../../tools/browser/angular-product-editor.smoke.spec.mts), [deletion](../../tools/browser/angular-products-delete.smoke.spec.mts).                                                                                                                                                                              |
| Reference availability, lazy boundary replacement, lookup CRUD, nullable/current/inactive relations and referenced deletion through Trash                       | `reference-workspace.spec.ts`, `venues/*.spec.ts`, `speakers/*.spec.ts`, `tags/*.spec.ts`; [Venues](../../tools/browser/angular-venues.smoke.spec.mts), [Speakers/Tags](../../tools/browser/angular-lookups.smoke.spec.mts).                                                                                                                                                                                      |
| Event URL state, exact EUR, Sofia instants/DST, paired registration dates, typed editor and remote relation hydration/search                                    | `event-form.spec.ts`, `event-editor.spec.ts`, `events-api.spec.ts`, `relation-picker.spec.ts`; [Events](../../tools/browser/angular-events.smoke.spec.mts).                                                                                                                                                                                                                                                       |
| Sanitized rich Description, links/paste/undo/redo/limits and saved overview                                                                                     | `event-form.spec.ts`, `event-editor.spec.ts`; [Events](../../tools/browser/angular-events.smoke.spec.mts), [long labels](../../tools/browser/angular-parity.smoke.spec.mts).                                                                                                                                                                                                                                      |
| Atomic Publish/Archive/Trash/Restore, retained failed selections, retired confirmation callbacks, read-only Trash and paged plain-text History                  | `events-api.spec.ts`, `event-history.spec.ts`, `event-history-values.spec.ts`; [lifecycle](../../tools/browser/angular-lifecycle.smoke.spec.mts).                                                                                                                                                                                                                                                                 |
| Event-scoped Sessions, time bounds, retained inactive Speakers, 100 limits, complete-set order drafts/retry/Cancel and parent background recovery               | `session-form.spec.ts`, `session-editor.spec.ts`, `sessions-api.spec.ts`, [overview recovery](../../apps/admin/src/app/features/reference/events/event-overview.spec.ts); [Sessions](../../tools/browser/angular-sessions.smoke.spec.mts).                                                                                                                                                                        |
| Gallery intent → binary → finalize, capability-only headers, cancellation/retired finalization, cover/Alt/null/order/preview/Trash and independent Event drafts | `media-api.spec.ts`, `event-gallery.spec.ts`; [Real Media](../../tools/browser/angular-media.smoke.spec.mts), [Prototype Media](../../tools/browser/angular-prototype-media.smoke.spec.mts).                                                                                                                                                                                                                      |
| Prototype exact-document/origin refusal, scoped resources, versioned storage, atomic History, native Blobs and Reset draining retired submissions               | `mocks/state.spec.ts`, `mocks/events.spec.ts`, `mocks/media.spec.ts`, `submitted-writes.spec.ts`; [basic Prototype](../../tools/browser/angular-prototype.smoke.spec.mts), [Prototype Events](../../tools/browser/angular-prototype-events.smoke.spec.mts), [Prototype Media](../../tools/browser/angular-prototype-media.smoke.spec.mts), [startup failures](../../tools/browser/angular-parity.smoke.spec.mts). |
| Local Body/Lists/Forms/States catalog, typed interactions, section/store/language resets, no persisted business writes and Real route rejection                 | `catalog-examples.spec.ts`, `ui-catalog.spec.ts`; [catalog](../../tools/browser/angular-ui-catalog.smoke.spec.mts).                                                                                                                                                                                                                                                                                               |

Validation evidence:

- `VITEST_MAX_WORKERS=1 npm run test:admin -- --skip-nx-cache`: all 364 tests passed across 42 files. The earlier focused `event-overview.spec.ts` / `admin-config.spec.ts` selection passed 11 cases in two files. The added parent-refresh case uses actual routing, Apollo and HTTP boundaries rather than replacing feature services.
- `npm run codegen`, `npm run schema:check` and `npm run test:schema -- contracts.unit.spec.mts` passed. The contract suite executed three cases with 18 explicit operation inputs; its final repeat after the discovery exclusion passed without indexing unrelated local packages.
- Root `npm run lint`, `npm run typecheck` and `npm run build` passed again after the final source/test changes, covering all six applications and tooling. Angular's initial production bundle is 689.76 kB, within the existing budgets. No budget, dependency or API input was changed.
- The focused `angular-parity.smoke.spec.mts angular-prototype-media.smoke.spec.mts` invocation passed 13 cases before the final long-label extension. A separate saved long-label case passed, and the final complete parity selection below repeats it with the Session editor. Early failures were corrected by waiting for settled responsive composition, using the actual localized decoder error and addressing the mode indicator within the banner; no deadline was increased.
- The combined `test:smoke:admin` invocation selected all 16 Angular browser files: foundation, shell, Product list/editor/deletion, Venues, lookups, Events, lifecycle, Sessions, Media, basic/rich Prototype, catalog and parity. It executed 123 cases: 118 passed and five timed out during service setup or long visual sweeps. This invocation is not recorded as wholly green. The two visual sweeps were partitioned into three independent viewport cases each, retaining every original screenshot/assertion. Each now uses the native 60-second deadline; the basic sweep's previous 120-second override was removed.
- `npm run test:smoke:admin -- angular-prototype-media.smoke.spec.mts angular-prototype.smoke.spec.mts angular-sessions.smoke.spec.mts angular-venues.smoke.spec.mts --grep="Sakai Prototype|Session CRUD persists|real filters, URL history|referenced batch deletion"`: all nine cases passed in one invocation. These cover all five earlier failures as six viewport cases and three Real workflows. Session CRUD, server filtering/nullable sorting/history and referenced partial deletion retain dedicated database fixtures. No failing required case remains unverified.
- `npm run test:smoke:admin -- angular-parity.smoke.spec.mts angular-events.smoke.spec.mts angular-lookups.smoke.spec.mts angular-venues.smoke.spec.mts --grep="parity composition|Long Event labels|Accessible startup failures|Sakai Event list|Bulgarian (Speakers|Tags|Venues) list and editor"`: all 13 cases passed in one invocation against the final build. This repeats every parity case and the affected Real Event/lookup visual checks after shared heading and status fixes. An intermediate 22-case command ended with SIGTERM without a test report; it is excluded from success evidence and its complete selection is covered by these two successful invocations.
- Current Angular browser coverage therefore includes every required capability in the matrix across the broad invocation and successful focused repeats. Real evidence uses actual compiled backends and guarded test schemas; Prototype evidence starts no backend. Unit and browser counts are separate, and cached generation/build tasks are not counted as live database verification.
- Reviewed the pinned Sakai shell/Form Layout at matching sizes against populated/failure views in both modes, both languages and both themes at 1280/992/991/390/320px. The final 108 parity captures include saved long Event/Tag labels and Session breadcrumbs. Reviewed refreshed Event/lookup/History/program/Gallery/preview/catalog captures and checked table scrolling to its action columns on the existing Prototype dev server. Local Lato, 28px card padding, responsive settings/actions and long text remain within the viewport. Captures stay ignored under `.references/review/`; fixture captures retain PrimeUI's standard license notice. Separate dev captures contain no notice or runtime errors, and their DOM-only long-label probes did not submit business writes.
- Changed-file Prettier, diff whitespace and local documentation link checks passed; all 559 Bulgarian/English keys match. The prior migration changes and private development configuration were preserved. Successful browser invocations closed their owned contexts/connections/processes. No task browser runner or test backend remains; only the preserved development process group owns service processes. Both existing admin URLs return HTTP 200.

PrimeNG MCP tools remained unavailable and `primeui doctor --json --tool codex --library primeng`
was not installed. Accordion tokens were checked against installed PrimeNG 22.1.2 style
metadata and [official Accordion guidance](https://primeng.dev/accordion), then compiled
and exercised in Chromium. No MCP usage-validation result is claimed. No new component
API was introduced. This audit does not establish cross-tab coordination, Sharp decoder
parity, universal accessibility certification or browser support beyond the executed Chromium
checks; these remain existing limitations rather than newly missing React workflows.

**M10 retirement decision:** no required parity gap remained; phase 18 was authorized
to remove the React application, dependencies, scripts and tests. The intentional single-Event operation and
unused Product selection differences above do not require another frontend feature.

## Historical migration scope

The phase 7 inventory found Stores/Products in Angular and the remaining Reference and
Prototype behavior in React. M1–M9 transferred those required capabilities into concrete
Angular features, using Sakai for presentation. M10 checked contracts, lifecycle isolation,
Real/Prototype behavior and responsive visuals. Detailed superseded source links and proposed
batches have been retired; the current [implementation index](../../docs/reference.md) and
[validation guide](../../docs/testing.md#angular-admin-checks) point to maintained Angular examples.
React/Aurora source and their original planning artifact remain recoverable from Git history.

## M11 / phase 18 — Workspace retirement: complete

Implementation removes the React application, its browser fixtures/cases, obsolete skill and
Aurora plan. Root npm commands, ESLint, Nx contract inputs, generation and affected CI select
only Angular and the four backends. npm updates the existing lockfile; ownership-based pruning
keeps Angular/backend dependencies and the pinned ignored Sakai source. No database, applied
migration, media directory, volume or external theme checkout is removed.

The Angular [browser config](../../tools/browser/angular.config.mts) directly selects its native
cases. Real retains the shared guarded [federation fixture](../../tools/graphql/federation-fixture.mts)
and dedicated schemas; Prototype retains its backend-free transport. The default Gateway/
Reference CORS origins use Angular port 11088, with configured overrides preserved.
Product docs and skills describe implemented Angular behavior and contain no deleted-source links.
The existing development process group is restarted together to preserve kill-others semantics.

Validation after retirement:

- `npm ci` passed from the updated npm-generated lockfile. Five workspaces/projects remain: admin, core, products, reference and gateway. npm removed 107 unused packages. Refine/MUI/Emotion/URQL, React adapters and React lint/testing dependencies are absent; Prisma Studio retains its own transitive React dependencies, documented in development.
- Root `npm run lint`, `npm run typecheck -- --parallel=1 --skip-nx-cache`, `npm run build -- --parallel=1 --skip-nx-cache`, `npm run codegen` and `npm run schema:check` passed. An initial Reference typecheck caught a missing legacy-origin argument in the edited test; the argument was restored and the full final typecheck passed. Final focused ESLint passed for that file.
- `npm run test:schema -- contracts.unit.spec.mts federation-guard.unit.spec.mts`: 6 passed in 2 files. The contract inventory now validates 10 explicit operation inputs, including all 8 Angular feature files.
- `npm run test:reference -- admin-origins.spec.ts health.spec.ts --skip-nx-cache`: 13 passed. `npm run test:gateway -- health.spec.ts --skip-nx-cache`: 3 passed.
- `VITEST_MAX_WORKERS=1 npm run test:admin -- --skip-nx-cache`: 364 passed in 42 files.
- `VITEST_MAX_WORKERS=1 npm run test:affected -- --files=apps/admin/src/app/features/products/products-api.ts --include=app/features/products/products-api.spec.ts --skip-nx-cache`: 6 schema/guard and 6 selected Angular cases passed; only admin was selected. These repeated cases prove argument forwarding/affected selection rather than adding distinct coverage.
- `npm run db:up`, `npm run db:setup` and `npm run db:test:setup` passed, preserving existing data/passwords. `npm run test:gateway:db -- federation.db.spec.mts --testNamePattern="allows the configured admin origin|keeps binary uploads outside the gateway"`: 2 executed cases passed, 21 unselected cases skipped. The noncached fixture used dedicated schemas/processes and owned temporary media.
- `npm run test:smoke:admin -- angular-foundation.smoke.spec.mts angular-product-editor.smoke.spec.mts angular-venues.smoke.spec.mts angular-lookups.smoke.spec.mts angular-events.smoke.spec.mts angular-lifecycle.smoke.spec.mts angular-sessions.smoke.spec.mts angular-media.smoke.spec.mts angular-prototype.smoke.spec.mts angular-prototype-events.smoke.spec.mts angular-prototype-media.smoke.spec.mts angular-ui-catalog.smoke.spec.mts --grep="compiled Angular discovers|a delayed real A response|real Products create|real Venue create|Speaker CRUD|Tag CRUD|Event CRUD saves|atomic lifecycle persists|Session CRUD persists|gallery saves bytes|backend-free (products|venues|speakers|tags) CRUD|accepts only exact Angular|backend-free Event editor|atomic lifecycle rollback|Reset waits for retired finalization|Reset waits for a delayed write|local list paging|rejects direct catalog"`: 22 passed in 12 files, no retries. This repeats Real CRUD/store isolation, Event lifecycle/children, uploads and backend-free persistence/Reset/catalog after deletion. All 127 Angular browser cases in 16 files remain discoverable; this batch did not rerun every case or full regression.
- actionlint 1.7.12 with ShellCheck passed both workflow files. The actual history step accepted a valid comparison and rejected missing/invalid commits and a checkout mismatch. Explicit Nx affected examples returned admin for Angular source, all five for SDL/Compose/workflow changes, products/gateway/admin for the Products migration, and none for documentation. Full regression remains workflow_dispatch only; no GitHub run was dispatched.
- All 216 existing changed/untracked source/config/doc files in the current diff passed Prettier, excluding the private development config and generated/binary assets. Local Markdown file/heading targets resolve; Bulgarian/English retain the same 559 keys. Retired source links/instructions and the obsolete Aurora plan/React skill are removed; historical evidence above stays explicitly historical.
- The development group was restarted with six application instances (four backends plus two Angular modes). Both admin URLs return HTTP 200; Reference upload preflight accepts localhost/127.0.0.1 on 11088, Gateway accepts its configured Angular origin, and ports 11081/11087 have no listeners. Only the retained development group owns backend processes after fixture cleanup. Private config/license, persistent databases/migrations/media/volumes and the ignored Sakai source are preserved.
- Reviewed fresh business-test Event/Product captures against the established Sakai composition. No UI styling changed in retirement; no new full comparison sweep was required. Test fixtures retain their standard PrimeUI license notice and do not load the private development license. The earlier full matching-viewport audit remains M10 evidence.

**Migration complete:** Angular is the sole admin application. No required retirement check remains failing. Current usage, ownership and validation are documented in the maintained product guides and skills. Changes remain uncommitted.
