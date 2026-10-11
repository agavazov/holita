# CRUD and Reference implementation index

The Angular admin uses Sakai with holita branding and native PrimeNG components.
Products is the concrete CRUD example; Reference adds relations, Events, child Sessions,
Gallery and atomic lifecycle/History workflows. Real uses the Gateway and Prototype uses
Angular-owned MSW behind the same generated documents and concrete Apollo services.
Use the [pinned Sakai source](development.md#sakai-source-reference) for presentation,
the feature files below for behavior and [Angular checks](testing.md#angular-admin-checks)
for focused validation. No cross-application implementation imports are required.

## Angular foundation

[Architecture](architecture/overview.md#angular-admin-foundation) describes the separate
Angular application with Real and Prototype modes. [Stores discovery](../apps/admin/src/app/features/stores/store-workspace.ts)
and [Products list](../apps/admin/src/app/features/products/products-page.ts) use concrete
feature services and generated operations against the same gateway. The
[Sakai shell](../apps/admin/src/app/layout/admin-shell.ts) is presentation-only; its
[navigation](../apps/admin/src/app/layout/admin-navigation.ts) and PrimeNG selectors use
explicit inputs. [Shell browser checks](../tools/browser/angular-shell.smoke.spec.mts)
cover desktop/mobile interaction, keyboard selection, language and themes. The Prototype-only
[Sakai UI catalog](../apps/admin/src/app/features/prototype/ui-catalog/ui-catalog.ts) demonstrates
native buttons/cards, local lists/menus/dialogs, typed forms and feedback states.
[Catalog checks](../tools/browser/angular-ui-catalog.smoke.spec.mts) cover local interactions,
store/language/section resets, persisted-data separation, Real rejection and responsive themes.
Sakai defines shell and feature presentation. Components own their domain state and rules.

[List query helpers](../apps/admin/src/app/features/products/product-list-query.ts) and the
[page](../apps/admin/src/app/features/products/products-page.ts) are the Angular reference for
server pagination, combined filters, sorting, URL normalization and cancellable text drafts.
Only same-query refresh failures retain rows. Query changes reuse the workspace client/cache
and dispose the obsolete read. See the
[list tests](../apps/admin/src/app/features/products/products-page.spec.ts) and
[real list browser cases](../tools/browser/angular-products-list.smoke.spec.mts).

[ProductEditor](../apps/admin/src/app/features/products/product-editor.ts) and its
[validators](../apps/admin/src/app/features/products/product-validation.ts) are the Angular
create/edit reference: typed Reactive Forms, generated inputs, first-invalid-field focus,
initial detail retry, dirty navigation and callback retirement. The
[editor tests](../apps/admin/src/app/features/products/product-editor.spec.ts) cover same-store
ID/mode changes, store/language changes and late writes; the
[real browser cases](../tools/browser/angular-product-editor.smoke.spec.mts) exercise Gateway
persistence, SKU conflicts, guarded navigation and the mobile form.

ProductsPage and ProductsApi are also the single/page-local deletion reference. PrimeNG Table
checkboxes and ConfirmDialog supply selection and confirmation; the page owns sequential
submission, partial-result messages, failed-row retry and final server reconciliation.
Query identity stops unsent operations and prevents late callbacks after list-query changes;
store/language/route destruction preserves only submitted writes. See the
[deletion tests](../apps/admin/src/app/features/products/products-deletion.spec.ts) for actual
Apollo transport and client shutdown assertions, and the
[real deletion browser cases](../tools/browser/angular-products-delete.smoke.spec.mts) for persistence,
partial failures, last-page correction, delayed writes and narrow confirmation layout.
This is the Angular Products CRUD example; do not treat its permanent sequential deletion as
a generic rule for Reference's related entities or transactional domain actions.

[Products scope tests](../apps/admin/src/app/features/products/products-api.spec.ts) and
[routing tests](../apps/admin/src/app/features/stores/store-workspace.spec.ts) verify captured
headers, separate caches, A → B → A and late writes. The
[compiled Angular browser checks](../tools/browser/angular-foundation.smoke.spec.mts) use real
backend processes and dedicated databases. See [commands](testing.md#angular-admin-checks).

### Angular Prototype transport

[Startup/configuration](development.md#angular-prototype) selects the mode once. The
[worker](../apps/admin/src/app/mocks/browser.ts), [exact document handlers](../apps/admin/src/app/mocks/handlers.ts)
and [snapshot state](../apps/admin/src/app/mocks/state.ts) own Stores/Products/Venues/Speakers/Tags
and Events/Sessions/Media/History transport and persistence. Concrete resource modules reuse
the Angular-generated contracts and the same feature screens/Apollo services. Current
Event/Session links protect lookup deletion, including Trash.
[Events](../apps/admin/src/app/mocks/events.ts), [Sessions](../apps/admin/src/app/mocks/sessions.ts)
and [History](../apps/admin/src/app/mocks/event-history.ts) preserve atomic snapshot writes.
[Media](../apps/admin/src/app/mocks/media.ts) and [IndexedDB](../apps/admin/src/app/mocks/media-storage.ts)
own capabilities, staged uploads, finalized bytes and orphan cleanup.
[Submitted write tracking](../apps/admin/src/app/core/graphql/submitted-writes.ts) and the
[store boundary](../apps/admin/src/app/features/stores/store-workspace.ts) own confirmed Reset,
retired submission draining, locale discovery and client/form replacement.
See [state checks](../apps/admin/src/app/mocks/state.spec.ts),
[write lifecycle checks](../apps/admin/src/app/core/graphql/submitted-writes.spec.ts) and
[basic browser checks](../tools/browser/angular-prototype.smoke.spec.mts),
[Events/Sessions/History checks](../tools/browser/angular-prototype-events.smoke.spec.mts) and
[Gallery/IndexedDB checks](../tools/browser/angular-prototype-media.smoke.spec.mts).

### Angular Reference Venues

[ReferenceWorkspace](../apps/admin/src/app/features/reference/reference-workspace.ts) gates
availability/store discovery and recreates the Venues list/editor on store/language/mode/ID
changes. [Boundary tests](../apps/admin/src/app/features/reference/reference-workspace.spec.ts)
cover disabled routes, unknown stores and section-preserving A → B → A navigation.

[VenuesPage](../apps/admin/src/app/features/reference/venues/venues-page.ts), its
[query helpers](../apps/admin/src/app/features/reference/venues/venue-list-query.ts) and
[VenuesApi](../apps/admin/src/app/features/reference/venues/venues-api.ts) implement real server
paging, name/activity filtering, sorting and sequential permanent deletion. The service uses
its own generated operations and captured Apollo client/cache; related-entity deletion errors
remain domain-owned. There is no generic Reference CRUD layer.

[VenueEditor](../apps/admin/src/app/features/reference/venues/venue-editor.ts) and
[validation](../apps/admin/src/app/features/reference/venues/venue-validation.ts) supply typed
fields, optional null mapping, country/capacity rules, server field focus, dirty navigation
and callback retirement. Sakai supplies presentation; the concrete feature owns behavior.

The feature-local API/page/editor/deletion/validation suites cover controlled Apollo HTTP.
[Real Venues browser cases](../tools/browser/angular-venues.smoke.spec.mts) cover persistence,
nullable updates, stable sorting, referenced partial deletion/retry, last-page correction,
delayed module/read/write retirement, dirty navigation, disabled Reference and Bulgarian narrow light/dark
views. See [usage](development.md#angular-reference-venues) and
[commands](testing.md#angular-admin-checks). Event images use the [Angular Gallery](#angular-reference-gallery).

### Angular Reference Speakers and Tags

- [Speakers page](../apps/admin/src/app/features/reference/speakers/speakers-page.ts),
  [editor](../apps/admin/src/app/features/reference/speakers/speaker-editor.ts),
  [API](../apps/admin/src/app/features/reference/speakers/speakers-api.ts) and
  [operations](../apps/admin/src/app/features/reference/speakers/operations.graphql): nullable
  Email/biography, address validation, activity and server Email sorting with nulls last.
- [Tags page](../apps/admin/src/app/features/reference/tags/tags-page.ts),
  [editor](../apps/admin/src/app/features/reference/tags/tag-editor.ts),
  [API](../apps/admin/src/app/features/reference/tags/tags-api.ts) and
  [operations](../apps/admin/src/app/features/reference/tags/operations.graphql): required HEX
  color, lowercase mapping/live preview and focused duplicate Name errors.

Each feature owns controlled-HTTP API/page/editor/deletion/validation suites. The
[lookup browser cases](../tools/browser/angular-lookups.smoke.spec.mts) exercise real CRUD,
null clearing, sorting/history, referenced deletion through Event Trash and partial retry,
A → B → A delayed reads/writes, dirty navigation and disabled availability. Shared Sakai styles
supply presentation; [usage](development.md#angular-reference-speakers-and-tags) records limits.

### Angular Reference Events

- [List](../apps/admin/src/app/features/reference/events/events-page.ts) and
  [URL/column helpers](../apps/admin/src/app/features/reference/events/event-list-query.ts):
  server Title/Code search, status/format/relation/featured filters, inclusive Sofia calendar
  ranges, capacity ranges, sorting, paging and per-store columns. Invalid range drafts keep
  the prior query; navigation restores URL state.
- [Editor](../apps/admin/src/app/features/reference/events/event-editor.ts),
  [form validation/input mapping](../apps/admin/src/app/features/reference/events/event-form.ts)
  and [Sofia time](../apps/admin/src/app/features/reference/events/event-time.ts): typed
  General/Schedule/Content, exact string budgets, immutable Code, nullable clearing,
  format-specific relations and dirty/retired submission lifecycles.
- [API](../apps/admin/src/app/features/reference/events/events-api.ts) and
  [operations](../apps/admin/src/app/features/reference/events/operations.graphql): concrete
  generated list/detail/create/update, atomic status/Trash/Restore, History and explicit Venue/Tag lookup queries with captured clients.
- [Relation picker](../apps/admin/src/app/features/reference/relation-picker.ts): shared
  presentation with caller-supplied loaders, selected-ID hydration, inactive labels, remote
  search/page/retry and read cancellation. No generic CRUD or business mutation lives here.
- [Rich input](../apps/admin/src/app/features/reference/events/description-editor.ts),
  [HTML boundary](../apps/admin/src/app/features/reference/events/description-html.ts) and
  [overview](../apps/admin/src/app/features/reference/events/event-overview.ts): Tiptap core
  ControlValueAccessor, supported formatting, safe web links and 100 KiB UTF-8 HTML.
- [Action dialog](../apps/admin/src/app/features/reference/events/event-action-dialog/event-action-dialog.ts)
  reuses the owning EventsApi for confirmed one-row and page-local atomic actions, with retry
  and destroyed-view callback checks. Selection and query retirement remain list-owned.
- [History](../apps/admin/src/app/features/reference/events/event-history/event-history.ts)
  owns server paging, cancellable reads, retry and expansion;
  [value formatting](../apps/admin/src/app/features/reference/events/event-history-values.ts)
  localizes labels, formats Sofia times and converts description excerpts to plain text.
  Trash overview is read-only with Restore. Its Sessions tab is disabled; media has no Angular controls yet.

Use [Event checks](testing.md#angular-admin-checks) and the
[real browser cases](../tools/browser/angular-events.smoke.spec.mts) for persistence,
list restoration, relations, rich text, delayed scope changes and Sakai desktop/mobile review.
[Lifecycle browser cases](../tools/browser/angular-lifecycle.smoke.spec.mts) exercise atomic
rollback/retry, reserved Code/child preservation, Trash/Restore, History and delayed actions.
[Lifecycle browser cases](../tools/browser/angular-lifecycle.smoke.spec.mts) exercise atomic
rollback/retry, reserved Code/child preservation, Trash/Restore, History and delayed actions.

### Angular Reference Sessions

- [Generated operations](../apps/admin/src/app/features/reference/sessions/operations.graphql)
  and [SessionsApi](../apps/admin/src/app/features/reference/sessions/sessions-api.ts): real
  Event-scoped list/detail/create/update/delete/complete-set reorder with an immutable captured
  store/language/parent client and retained submitted writes.
- [Editor](../apps/admin/src/app/features/reference/sessions/session-editor/session-editor.ts)
  and [typed helpers](../apps/admin/src/app/features/reference/sessions/session-form.ts): Title,
  plain Summary, Room, exact Sofia instants, parent bounds, remote active Speaker choices,
  retained inactive assignments, null clearing, server-field focus and route retirement.
- [Program](../apps/admin/src/app/features/reference/sessions/session-program/session-program.ts):
  native drag/up/down draft, position announcements, atomic Save, server-reloading Cancel,
  retained conflict/retry, dirty guards and confirmed permanent deletion.
- [Speaker summary](../apps/admin/src/app/features/reference/sessions/event-speakers/event-speakers.ts)
  deduplicates the current program's Speakers. Trash blocks children; Restore retains them.

See [usage](development.md#angular-reference-sessions), [unit/browser checks](testing.md#angular-admin-checks)
and [real browser cases](../tools/browser/angular-sessions.smoke.spec.mts). Sakai owns presentation;
The same program/editor serves Prototype through Angular-owned operations.

### Angular Reference Gallery

- [Generated operations](../apps/admin/src/app/features/reference/media/operations.graphql)
  and [MediaApi](../apps/admin/src/app/features/reference/media/media-api.ts): captured
  store/language/Event list, intent/finalization, metadata, cover, permanent removal and
  complete-set order with retained submitted writes.
- [Gallery](../apps/admin/src/app/features/reference/media/event-gallery/event-gallery.ts):
  independently saved images, typed Alt text/null clearing, cover fallback, confirmed removal,
  native drag/keyboard ordering drafts, dirty guards and read-only overview previews.
- [Direct upload](../apps/admin/src/app/features/reference/media/direct-upload.ts): captured
  capability-only XHR File transfer, progress/deadline/cancellation before finalization.
- [Controlled HTTP/lifecycle cases](../apps/admin/src/app/features/reference/media/media-api.spec.ts)
  and [real browser cases](../tools/browser/angular-media.smoke.spec.mts): bytes surviving reload,
  cancellation, retired writes, metadata/order retry, invalid files, renewed previews,
  Trash/Restore and Sakai desktop/mobile light/dark presentation.

See [usage](development.md#angular-reference-gallery), [storage contract](architecture/overview.md#event-media-and-direct-uploads)
and [validation](testing.md#angular-admin-checks). Angular Prototype exposes the same CRUD and Event/Session/Gallery/History workflows. The lazy Sakai UI catalog supplies local examples in Prototype.

## UI catalog and shared components

Angular's Prototype catalog uses [BodyExamples](../apps/admin/src/app/features/prototype/ui-catalog/body-examples/body-examples.ts),
[ListExamples](../apps/admin/src/app/features/prototype/ui-catalog/list-examples/list-examples.ts),
[FormExamples](../apps/admin/src/app/features/prototype/ui-catalog/form-examples/form-examples.ts)
and [StateExamples](../apps/admin/src/app/features/prototype/ui-catalog/state-examples/state-examples.ts).
These are section-local presentation examples with native PrimeNG components and Sakai spacing.
They do not supply shared business validation, wrappers or a data provider. Lists owns its local
paging/selection/dialogs; Forms owns typed controls, first-error focus and draft-preserving
state previews. [Usage](development.md#ui-catalog) describes scope and resets.

## Boundaries to preserve

Products supplies URL-backed lists, typed editors and sequential page-local deletion.
Venues/Speakers/Tags add referenced-delete failures and concrete validation. Events uses
atomic 1–100-ID lifecycle mutations; Sessions and Gallery use complete-set ordering.
Reuse those behaviors only where the domain requires them. Keep components → concrete
feature service → generated Apollo documents, and retain each workspace/route/parent client.
Submitted writes settle in their captured scope; obsolete reads and UI callbacks retire.

Shared Reference SCSS supplies presentation. The UI catalog supplies local examples, with
no business operations or persisted fixtures. Extract another shared component only from
concrete reuse. Backend resolvers/services/repositories and persistence remain inside their
owning service; see [Reference architecture](architecture/overview.md#reference-event-management)
and [media configuration](development.md#reference-media-configuration).

## Vehicles

[Vehicles](../apps/reference/src/vehicles/vehicles.graphql) is a concrete two-field,
store-scoped CRUD module in Reference. License Plate is required (32 code points maximum);
Notes is optional plain text (2000 maximum), with null clearing and multiline display.
[VehicleEditor](../apps/admin/src/app/features/reference/vehicles/vehicle-editor.ts) uses typed
Reactive Forms and [VehiclesPage](../apps/admin/src/app/features/reference/vehicles/vehicles-page.ts)
uses URL-backed search, sorting, paging and confirmed page-local deletion. Both Real and
Prototype use [generated operations](../apps/admin/src/app/features/reference/vehicles/operations.graphql).
The scoped API/editor/deletion tests exercise retired clients, A → B → A, dirty forms and
late callbacks. [Database checks](../apps/reference/test/vehicles.db.spec.ts) cover persistence,
null clearing, context, federation references and literal search. [Browser checks](../tools/browser/angular-vehicles.smoke.spec.mts)
cover CRUD/reload/scoping in both modes and Bulgarian desktop/mobile light/dark presentation.
