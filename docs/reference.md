# CRUD and Reference implementation index

Products is the working Aurora/MUI CRUD reference in holita. Reference adds Event Management
with relations, child records and lifecycle operations. Both use the same gateway and store
context, with independent services and databases. See [Products usage](development.md#using-products),
[Reference usage](development.md#using-reference) and [application boundaries](architecture/overview.md).

Products and all Reference workflows use Aurora/MUI. Reference adds concrete domain behavior,
relations and lifecycle examples. Choose only the capabilities needed by the module.

## Products: the Aurora CRUD reference

The working slice is explicit: [list](../apps/admin/src/features/products/product-list.tsx),
[editor](../apps/admin/src/features/products/product-editor.tsx) and
[form](../apps/admin/src/features/products/product-form.tsx) →
[named operations](../apps/admin/src/features/products/operations.graphql) →
[provider mapping](../apps/admin/src/data/products-provider.ts) →
[SDL](../apps/products/src/products/products.graphql),
[resolver](../apps/products/src/products/products.resolver.ts),
[service](../apps/products/src/products/products.service.ts) and
[repository](../apps/products/src/products/products.repository.ts).
Generated API types connect those layers; the owning service's Prisma schema owns persistence.
See [Products usage](development.md#using-products) for the user-visible behavior.

| Part                 | Reuse and ownership                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header               | [PageHeader](../apps/admin/src/components/page-header.tsx) supplies Aurora's breadcrumb/title/action composition. `embedded` fits it inside a form's main panel. The module supplies routes, labels and useful actions.                                                                                                                                                                                 |
| Table                | MUI X DataGrid uses the shared [Aurora overrides](../apps/admin/src/theme/components/DataGrid.tsx), checkbox/tab styling and [pagination](../apps/admin/src/components/data-grid-pagination.tsx). Keyboard focus styling belongs to the theme. Built-in column menus, filter panels and column management are not configured for this CRUD.                                                             |
| List state           | ProductList owns its concrete columns, Refine query, selection and URL state. Quick and advanced search share one draft; SKU has its own draft. `changeListQuery` commits filter/sort changes together, preserving unrelated query parameters and resetting the page. Text waits 300 ms; status and sorting commit immediately, including pending text.                                                 |
| Filter and row menus | [FilterDrawer](../apps/admin/src/components/filter-drawer.tsx) owns the responsive Aurora panel; [RecordActions](../apps/admin/src/components/record-actions.tsx) owns the shared row menu. Products, Venues, Speakers and Tags use Edit/Delete; Events supplies View, Edit/Restore and Move to trash. Filter controls, values and callbacks stay in each feature; these components do not access data. |
| Form                 | [EditorAside](../apps/admin/src/components/editor-aside.tsx) supplies the sticky desktop settings/summary panel and its action area for Products, Venues, Speakers, Tags and Events; it follows the fields on mobile. Each form owns its draft, validation and content; its editor owns loading, mutations, errors and navigation.                                                                      |
| Data and lifecycle   | The [single provider](../apps/admin/src/data/data-provider.ts) and [store workspace](../apps/admin/src/features/stores/store-workspace.tsx) own captured request scope, cache identity and store/route remounts. Share them directly; do not copy transports or global store state.                                                                                                                     |

The feature files are concrete examples, not shared generic list/form controllers. Reuse
existing presentation components directly; adapt feature-owned fields, API filters/sorts,
validation, deletion rules and notifications to the module. Products does not establish a
universal batch API, relation picker, upload workflow or dirty-form policy.

### State and mutation boundaries

- The URL is the committed list query. Only text input needs a local draft. Programmatic
  URL synchronization and Clear filters do not schedule text searches; immediate changes
  cancel the pending debounce so an old draft cannot restore cleared filters.
  Navigation restores drafts from the destination URL, even when only another filter changed;
  browser Back/Forward discards text that has not been committed yet.
- Selection belongs to the current page/filter/sort combination and resets when it changes.
  Use the grid's unknown count (`-1`) before the first successful response, then keep the
  last known total while loading. This preserves a bookmarked page during the initial request;
  pagination controls are disabled while the first response is loading. Keep the controlled
  sort model stable until its field/direction changes: MUI treats a new model identity as a
  sorting change and resets pagination. Sort/filter results and totals come from the server,
  not the displayed page. Cached rows remain selectable during background refreshes;
  row selection is blocked while deleting.
- A synchronous submission guard prevents a second mutation before React updates pending UI.
  Mutation arguments capture the scoped resource. Per-call callbacks stop affecting the UI
  after its route/store unmounts; an already submitted write can still finish on the server.
- The workspace keys the Products subtree by store and its route subtree by semantic route
  identity (feature, create/edit mode and record), excluding the locale segment. A language-only
  URL change therefore keeps a dirty editor mounted, while store, resource or record changes still
  establish a new lifecycle boundary. The editor does not add another form key for the same boundary. Once mounted, the form
  initializes its values once; refreshed query data does not reset that local draft.
  An initial read failure blocks the editor, but a failed background refresh keeps the
  loaded form mounted and shows a retry warning. Store discovery follows the same rule:
  a refresh failure retains the last successful stores and the active feature subtree.
  Successful discovery still updates which stores are available.
- Products and LookupList share [useRecordDeletion](../apps/admin/src/features/use-record-deletion.ts)
  for sequential scoped `useDelete` calls. Successful rows stay deleted,
  failures remain for retry, and navigation stops the unsent remainder. Preserve each
  module's actual delete constraints; do not replace a domain bulk operation with this loop.
  Lists still own selection, pagination, confirmation text and success notices.

Products currently supports one sort column, page-local selection and the shared Delete
batch action. Save/Cancel return to the base Products list; browser Back restores a previous
list URL. Products has no dirty-form confirmation. Reference's existing dirty guards and
richer Event list return-state behavior remain part of those modules' contracts.

Focused checks: [list query transitions](../apps/admin/src/features/products/product-list.test.tsx),
[form validation](../apps/admin/src/features/products/product-form.test.tsx),
[provider mapping](../apps/admin/src/data/data-provider.test.ts),
[store/route and batch lifecycle](../apps/admin/src/features/stores/store-workspace.test.tsx),
[Aurora list/form browser cases](../tools/browser/products-aurora.smoke.spec.mts) and
[real CRUD/store-switch cases](../tools/browser/products.smoke.spec.mts).
The [Products service tests](../apps/products/src/products/products.service.spec.ts),
[GraphQL/database tests](../apps/products/test/products.db.spec.ts) and
[federation cases](../tools/graphql/federation.db.spec.mts) protect backend contracts.
Use the [testing guide](testing.md) for exact commands and dedicated database prerequisites.

## Events: Aurora with domain-specific workflows

The [Event list](../apps/admin/src/features/reference/events/event-list.tsx) reuses the shared
header, DataGrid theme/pagination, filter drawer and row menu. Its
[list state](../apps/admin/src/features/reference/events/event-list-state.ts) keeps the existing
URL contract, default start ascending, per-store column preferences and list-return links.
Quick and drawer title/code search share a 300 ms draft; enum, relation, date and capacity
filters apply on change. Invalid ranges remain editable with a message and do not replace the
committed query. Reset cancels pending text and clears range drafts. Navigation restores
range drafts from the URL, including Back/Forward when only another filter changed;
invalid drafts remain editable until a navigation or reset. Each filter/sort/page change
clears page-local selection. Active rows open Edit; View opens the overview; trash rows
open the read-only overview. Events retain their atomic Publish/Archive/Trash/Restore API and
confirmation. Do not replace it with the supporting entities' sequential hard-delete loop.

The [form](../apps/admin/src/features/reference/events/event-form.tsx) uses the shared Create Event
aside for Status, Featured, Capacity, Budget, summary and Save/Cancel. General, Schedule &
location and Content & media retain local drafts across tabs; validation opens and focuses the
first recognized field. The concrete [form values](../apps/admin/src/features/reference/events/event-form-state.ts)
map native date/time inputs to the existing Sofia conversion, retain untouched instants including
seconds, milliseconds and the repeated autumn hour, and keep money as an exact decimal string. No date-picker or form
library is required. [The editor](../apps/admin/src/features/reference/events/event-editor.tsx)
owns Refine mutations, captured store scope, gallery dirty/pending coordination and route callbacks.
[StoreWorkspace](../apps/admin/src/features/stores/store-workspace.tsx) loads the Reference UI
with React lazy/Suspense only when an enabled Reference route is opened. Products and disabled
Reference routes do not download that UI. ReferenceWorkspace separately loads the Event editor
and Tiptap on demand; lists and other forms do not download the rich editor. Existing
store/pathname keys still isolate mutations across these loading boundaries.
Reference editors also preserve their local drafts during failed background reads and retries.
The Event overview retains its child workflows on refresh failure, including unsaved session order.

[RelationSelect](../apps/admin/src/features/reference/relation-select.tsx) uses MUI Autocomplete with
the original [Aurora Autocomplete styling](../apps/admin/src/theme/components/Autocomplete.tsx),
Refine remote paging, search, retry and separate ID hydration for inactive existing selections.
Event and Session forms share it. The Tiptap editor has MUI controls and retains
its HTML sanitation, byte limit and route-scoped selection/undo history.
The [overview](../apps/admin/src/features/reference/events/event-show.tsx) uses Aurora typography,
summary/details sections and tabs. Its child workflows also follow the selected Aurora preset:

- [Session editor](../apps/admin/src/features/reference/sessions/session-editor.tsx) and
  [form](../apps/admin/src/features/reference/sessions/session-form.tsx) reuse PageHeader and
  EditorAside. The concrete form validates parent bounds, end-after-start and speaker limits.
  Both Event and Session native date/time inputs use
  [eventInputInstant](../apps/admin/src/features/reference/events/event-time.ts) to validate Sofia
  wall time and preserve exact untouched instants despite minute-precision inputs. Drafts, field-error focus and mutations
  remain scoped to their store, parent Event and editor route.
- [Session program](../apps/admin/src/features/reference/sessions/session-list.tsx) adapts Aurora's
  rounded Create Event sections, with title/row navigation and the shared Edit/Delete menu.
  Native drag and move buttons change a local order; Save order uses the existing complete
  permutation mutation. Cancel reloads the server. Ordering is independent of session times.
  [Speaker summary](../apps/admin/src/features/reference/sessions/event-speakers.tsx) derives a
  unique roster from the same scoped session query and labels inactive speakers.
- [Gallery](../apps/admin/src/features/reference/media/event-gallery.tsx) uses Aurora Paper/upload
  presentation, a native file input and MUI progress/dialogs. Upload, cover, alt text and removal
  save independently; ordering stays a draft until saved. Preview supports previous/next images,
  arrow keys and Escape. Existing upload hooks own cancellation and scoped finalization.
- [History](../apps/admin/src/features/reference/events/event-history.tsx) uses the original
  [Aurora table overrides](../apps/admin/src/theme/components/Table.tsx) and an expandable MUI
  table. It requests 20 entries per page, newest first, and renders excerpts as escaped text.
  Page changes clear expanded rows; loading, failure and empty results remain distinct.

These are concrete workflows, not a configurable CRUD engine. Store discovery also uses the
shared Aurora PageHeader and MUI controls. Its loading, error/retry, empty and unavailable-route
states remain owned by StoreWorkspace; layout receives plain inputs without feature queries.
There is no Ant Design runtime dependency or compatibility provider.

Focused checks: [form values](../apps/admin/src/features/reference/events/event-form-state.test.ts),
[editor lifecycle](../apps/admin/src/features/reference/events/event-workspace.test.tsx),
[list/overview](../apps/admin/src/features/reference/events/event-list.test.tsx),
[atomic lifecycle](../apps/admin/src/features/reference/events/event-lifecycle.test.tsx),
[real Events flow](../tools/browser/events.smoke.spec.mts), [rich text](../tools/browser/rich-text.smoke.spec.mts)
and [lifecycle browser flow](../tools/browser/lifecycle.smoke.spec.mts).

## Reference: domain-specific extensions

Venues is the smallest Reference service slice. Its
[list](../apps/admin/src/features/reference/venues/venue-list.tsx),
[editor](../apps/admin/src/features/reference/venues/venue-editor.tsx) and
[form](../apps/admin/src/features/reference/venues/venue-form.tsx) use Aurora/MUI and the shared
header, DataGrid theme/pagination, filter drawer, row actions and editor aside.
The existing [LookupList](../apps/admin/src/features/reference/lookup-list.tsx) now owns the
common list behavior for Venues, Speakers and Tags. Their small list adapters supply the
scoped resource, typed detail columns and deletion guidance.
[LookupFilters](../apps/admin/src/features/reference/lookup-filters.tsx) supplies their shared
name/status controls. Keep this reuse limited to the three supporting entities; Products
and Events have their own lists and domain behavior.
Venue, Speaker, Tag and Event forms share the small
[text validator](../apps/admin/src/features/reference/text-validation.ts) for required text,
Unicode character counts and null-character rejection. Field limits, messages and domain
validation remain in each form.
Quick and panel name search share a 300 ms draft; Active/Inactive and sorting apply immediately.
Name, City, Country, Capacity and Status sort on the server before pagination, with an ID
descending tie-breaker and null capacity last in either direction. The default remains newest first.
URL state, selection reset, unknown initial totals and sequential deletion follow Products.
Referenced venues cannot be deleted; partial failures retain only failed records for retry.
The form shows Venue details and Location together, with Active, Capacity and Summary in
the aside. Save/Cancel return to the base list. Unlike Products, Venue retains dirty-navigation
confirmation and allowlisted field-error display/focus. Failed saves preserve the draft.
The Reference workspace supplies store-scoped MUI success notices, and its shared dirty-form
dialog uses MUI; their lifetimes and router/store boundaries are unchanged.

[SpeakerForm](../apps/admin/src/features/reference/speakers/speaker-form.tsx) uses Name, Email
and Short biography with the same aside and dirty-navigation lifecycle. Email and biography
normalize blanks to null; inactive status is preserved.
[TagForm](../apps/admin/src/features/reference/tags/tag-form.tsx) uses a six-digit HEX field and
native color picker with a preview; it normalizes color to lowercase. A duplicate name keeps
the draft and focuses Name. Speaker sorting additionally supports Email (null last), and Tag
sorting supports Color. Referenced Speakers/Tags cannot be deleted; batch failures retain
only the failed records for retry, with count-aware success notices.
Their editors, GraphQL operations, provider mappings and backend repositories remain concrete.
No additional dependency or database migration is needed for this presentation and sorting.

Focused checks: [Venue form](../apps/admin/src/features/reference/venues/venue-form.test.tsx),
[list state](../apps/admin/src/features/reference/venues/venue-list.test.tsx),
[Reference workspace](../apps/admin/src/features/reference/reference-workspace.test.tsx),
[Venue DB](../apps/reference/test/venues.db.spec.ts),
[CRUD/lifecycle browser cases](../tools/browser/reference.smoke.spec.mts) and
[Aurora Venue browser cases](../tools/browser/venues-aurora.smoke.spec.mts),
[Speaker/Tag forms](../apps/admin/src/features/reference/lookup-forms.test.tsx),
[lookup sorting/constraints](../apps/reference/test/events.db.spec.ts) and
[Aurora Speaker/Tag browser cases](../tools/browser/lookups-aurora.smoke.spec.mts).
Its [operations](../apps/admin/src/features/reference/venues/operations.graphql),
[provider](../apps/admin/src/data/venues-provider.ts),
[SDL](../apps/reference/src/venues/venues.graphql),
[resolver](../apps/reference/src/venues/venues.resolver.ts),
[service](../apps/reference/src/venues/venues.service.ts) and
[repository](../apps/reference/src/venues/venues.repository.ts) show Reference's concrete
contracts and store-scoped persistence. Keep those domain rules when adapting presentation.
Reference's [schema](../apps/reference/prisma/schema.prisma),
[migrations](../apps/reference/prisma/migrations) and
[seeds](../apps/reference/prisma/seed.ts) remain owned by that service.

## Find a richer example

| Need                                                                      | Implementation                                                                                                                                                                                                                                                                                                         | Behavioral checks                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store and route isolation, pending writes, dirty navigation               | [Store workspace](../apps/admin/src/features/stores/store-workspace.tsx), [Reference routes](../apps/admin/src/features/reference/reference-workspace.tsx), [unsaved changes](../apps/admin/src/features/reference/use-unsaved-changes.tsx)                                                                            | [Store lifecycle](../apps/admin/src/features/stores/store-workspace.test.tsx), [mobile navigation](../tools/browser/reference-layout.smoke.spec.mts)                                                                             |
| Sectioned forms, money, dates, conditional fields and field errors        | [Event form](../apps/admin/src/features/reference/events/event-form.tsx), [editor](../apps/admin/src/features/reference/events/event-editor.tsx), [Sofia time conversion](../apps/admin/src/features/reference/events/event-time.ts), [service validation](../apps/reference/src/events/events.service.ts)             | [Event admin](../apps/admin/src/features/reference/events/event-workspace.test.tsx), [Event persistence](../apps/reference/test/events.db.spec.ts), [time cases](../apps/admin/src/features/reference/events/event-time.test.ts) |
| Remote single/multiple relations without preloading tables                | [Relation select](../apps/admin/src/features/reference/relation-select.tsx), [Event repository](../apps/reference/src/events/events.repository.ts), [Speaker assignments](../apps/admin/src/features/reference/sessions/event-speakers.tsx)                                                                            | [Event browser flow](../tools/browser/events.smoke.spec.mts), [Session persistence](../apps/reference/test/sessions.db.spec.ts)                                                                                                  |
| URL filters, pagination, sorting, column preferences and overview actions | [Event list](../apps/admin/src/features/reference/events/event-list.tsx), [list state](../apps/admin/src/features/reference/events/event-list-state.ts), [overview](../apps/admin/src/features/reference/events/event-show.tsx)                                                                                        | [List/overview cases](../apps/admin/src/features/reference/events/event-list.test.tsx), [browser checks](../tools/browser/events.smoke.spec.mts)                                                                                 |
| Child CRUD and explicit ordering                                          | [Session list](../apps/admin/src/features/reference/sessions/session-list.tsx), [order draft](../apps/admin/src/features/reference/sessions/use-session-order.ts), [Session service](../apps/reference/src/sessions/sessions.service.ts)                                                                               | [Session browser flow](../tools/browser/sessions.smoke.spec.mts)                                                                                                                                                                 |
| Rich text with a bounded, sanitized HTML contract                         | [Description editor](../apps/admin/src/features/reference/events/description-editor.tsx), [backend sanitizer](../apps/reference/src/events/description-html.ts)                                                                                                                                                        | [Sanitizer tests](../apps/reference/src/events/description-html.spec.ts), [rich text browser flow](../tools/browser/rich-text.smoke.spec.mts)                                                                                    |
| Gallery, direct upload, preview, alt text and cover                       | [Gallery](../apps/admin/src/features/reference/media/event-gallery.tsx), [upload hooks](../apps/admin/src/features/reference/media/use-media-actions.ts), [HTTP transport](../apps/admin/src/data/direct-upload.ts), [Media service](../apps/reference/src/media/media.service.ts)                                     | [Gallery admin](../apps/admin/src/features/reference/media/event-gallery.test.tsx), [Media persistence](../apps/reference/test/media.db.spec.ts), [browser flow](../tools/browser/media.smoke.spec.mts)                          |
| Atomic bulk actions, Trash/restore and transactional history              | [Bulk actions](../apps/admin/src/features/reference/events/event-bulk-actions.tsx), [history UI](../apps/admin/src/features/reference/events/event-history.tsx), [Event repository](../apps/reference/src/events/events.repository.ts), [history repository](../apps/reference/src/events/event-history.repository.ts) | [Lifecycle persistence](../apps/reference/test/lifecycle.db.spec.ts), [admin cases](../apps/admin/src/features/reference/events/event-lifecycle.test.tsx), [browser flow](../tools/browser/lifecycle.smoke.spec.mts)             |
| Disabled mode with retained data and continued Products access            | [Backend guard](../apps/reference/src/reference-enabled.guard.ts), [admin route boundary](../apps/admin/src/features/stores/store-workspace.tsx)                                                                                                                                                                       | [Federation checks](../tools/graphql/federation.db.spec.mts), [disabled browser flow](../tools/browser/reference-disabled.smoke.spec.mts)                                                                                        |

## Boundaries to preserve

Store context scopes data; it is not authentication. The [core client](../apps/reference/src/core/core.client.ts)
checks store existence at creation. Repositories require the active store for reads and
writes. Admin mutations capture the scoped resource when submitted; route/store changes
unmount editors, while Refine invalidates the original resource. History attributes changes
to Anonymous because authenticated identity is not implemented.

Uploads use GraphQL intent → direct HTTP transfer → GraphQL finalization. Binary files
never pass through the gateway. The [storage contract](../apps/reference/src/media/media-storage.ts),
[local implementation](../apps/reference/src/media/local-media-storage.ts),
[HTTP controller](../apps/reference/src/media/media.controller.ts) and
[cleanup](../apps/reference/src/media/media.cleanup.ts) implement private local storage,
short-lived upload/read URLs and orphan cleanup. Only local storage is implemented;
there is no AWS dependency or object-storage adapter. See [media configuration and limits](development.md#using-reference).

Keep schema and operations as generator inputs; do not copy generated clients or import
another application's implementation. Follow the [backend](../.agents/skills/holita-backend-feature/SKILL.md)
and [admin](../.agents/skills/holita-admin-feature/SKILL.md) procedures for changes, and use
the [focused check mapping](testing.md#reference-checks) to select actual test files.
Database and browser fixtures own isolated schemas and processes; normal development data
is not a test fixture.
