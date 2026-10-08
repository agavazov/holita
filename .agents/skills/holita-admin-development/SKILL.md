---
name: holita-admin-development
description: Review, maintain or extend Holita's Angular admin in apps/admin using generated GraphQL contracts, Real/Prototype transports and store-scoped Apollo client lifecycles. Use for Angular UI, data access and store/route isolation work; not for backend implementation.
---

# Holita Angular admin development

Read [AGENTS.md](../../../AGENTS.md), the
[implemented foundation](../../../docs/architecture/overview.md#angular-admin-foundation)
and the relevant [checks](../../../docs/testing.md#angular-admin-checks).
Use the installed `angular-developer` skill for framework conventions and the PrimeNG
plugin's `primeng-router` skill to select the relevant official workflow. Read only the
references and component metadata needed by the change. See
[tool installation](../../../docs/development.md#angular-agent-tools) if the plugin is missing.

## Trace the concrete implementation

- [app.config.ts](../../../apps/admin/src/app/app.config.ts) configures routing, HTTP,
  the Aura compatibility preset and the unscoped Stores Apollo client. Runtime endpoint/license configuration is
  loaded before bootstrap, including optional Reference availability; preserve the real Gateway path and keep issued keys out of Git.
- [StoreWorkspace](../../../apps/admin/src/app/features/stores/store-workspace.ts) owns
  discovery and route selection. The URL is the active store/language source. Unknown stores
  cannot start Products or Reference requests. Shell components receive inputs and emit selection;
  they do not perform business queries.
- [StoreProducts](../../../apps/admin/src/app/features/products/store-products.ts) keys
  the feature boundary by store and language. Angular reuses parameterized routes, so
  removing this boundary would retain the previous workspace's state and client. Its computed
  collection includes store/language/Product ID; changing only the tracking expression can retain the page.
- [ProductsPage](../../../apps/admin/src/app/features/products/products-page.ts) owns
  presentation/query state and delegates to
  [ProductsApi](../../../apps/admin/src/app/features/products/products-api.ts).
  Keep component → concrete feature service → Apollo; add no repository, facade or generic CRUD layer.
  Initialize its scoped client once, then watch generated variables for each list query.
  [Product list helpers](../../../apps/admin/src/app/features/products/product-list-query.ts)
  own URL decoding and variable mapping. Keep applied state in the URL and text drafts local;
  cancel debounce on navigation/reset, dispose obsolete reads and retain rows only for same-query refresh.
  Do not let Table's controlled sort events issue feedback queries or reset bookmarked pages before a total arrives.
- [ReferenceWorkspace](../../../apps/admin/src/app/features/reference/reference-workspace.ts)
  gates startup availability/discovered stores and keys Venues/Speakers/Tags/Events by store/language/resource/editor mode/ID.
  Store selection preserves the enabled Reference section and resets its list context.
  [VenuesPage](../../../apps/admin/src/app/features/reference/venues/venues-page.ts),
  [VenueEditor](../../../apps/admin/src/app/features/reference/venues/venue-editor.ts) and
  [VenuesApi](../../../apps/admin/src/app/features/reference/venues/venues-api.ts) are concrete
  Reference CRUD examples. Preserve false activity, country/capacity validation, nullable field
  mapping, server-field focus and referenced-row deletion failures without generalizing domain rules.
- [Speakers](../../../apps/admin/src/app/features/reference/speakers/speaker-editor.ts) and
  [Tags](../../../apps/admin/src/app/features/reference/tags/tag-editor.ts) have concrete services,
  lists, operations and validators. Preserve optional Email/biography null clearing, Email null-last
  sorting, Tag HEX lowercase/live preview and duplicate Name field errors. Referenced deletion
  remains protected through Event Trash. Shared Reference SCSS contains presentation only.
- [Events](../../../apps/admin/src/app/features/reference/events/event-editor.ts) owns concrete
  list/query/form/time/HTML helpers, API and overview. Preserve exact decimal strings and stored
  Sofia instants, format-specific relations, remote picker retirement and typed rich input.
  Tiptap core and DOMPurify provide the rich-text boundary.
  The Event action dialog uses captured-client atomic status/Trash/Restore mutations with
  explicit page-local IDs; list selection/query state stays in EventsPage. Trash overview is
  read-only. History owns cancellable server paging/expansion and plain-text description
  excerpts. The saved editor and overview mount their own Event-scoped Gallery.
- [SessionsApi](../../../apps/admin/src/app/features/reference/sessions/sessions-api.ts),
  [editor](../../../apps/admin/src/app/features/reference/sessions/session-editor/session-editor.ts)
  and [program](../../../apps/admin/src/app/features/reference/sessions/session-program/session-program.ts)
  own concrete Event-scoped CRUD, typed bounds/Sofia/nullable fields, remote Speakers and
  native drag/button order drafts. Keep complete-set atomic Save, failed-draft retention,
  server-reloading Cancel, dirty tab/route guards and captured parent/client retirement.
  The overview's Speaker summary deduplicates saved assignments; Trash blocks all child reads.
- [MediaApi](../../../apps/admin/src/app/features/reference/media/media-api.ts),
  [Gallery](../../../apps/admin/src/app/features/reference/media/event-gallery/event-gallery.ts)
  and [direct upload](../../../apps/admin/src/app/features/reference/media/direct-upload.ts)
  provide the concrete three-stage workflow. Trace intent capability and Event/client capture,
  cancellation before finalize, submitted-write retirement, independent Event drafts,
  complete-set order/reloading Cancel, typed Alt text, cover/removal and preview renewal.
- [graphqlOptions](../../../apps/admin/src/app/core/graphql/graphql-options.ts) captures
  store/language in each client transport. Each mounted Products or Reference workspace has its own
  `InMemoryCache`. Headers alone do not isolate cache entries or query deduplication.

## Preserve contracts and lifecycle

1. Keep named operations beside their feature in `operations.graphql`. Consume the ignored
   generated TypedDocumentNodes and input/result types. After operation changes run
   `npm run codegen` and `npm run schema:check`. Do not change backend contracts implicitly.
2. Capture the initiating client/store at mutation submission. Destroying a workspace
   disposes reads but lets already submitted writes settle. Invalidation affects only that
   captured client; late results cannot update another store or a newly mounted editor.
3. Keep reactive presentation state in signals and derived state in `computed`. Use RxJS
   for Apollo/router streams and their cancellation; preserve subscription cleanup.
   Refetch completion must still belong to its initiating query before updating a reused workspace.
   Do not add another global state/cache library.
4. Use typed Reactive Forms for business editors, with feature-owned validation and explicit
   mapping to generated inputs. The shell's single store selector is not a business editor.
   [ProductEditor](../../../apps/admin/src/app/features/products/product-editor.ts) is the concrete
   create/edit example. Hydrate detail values once, disable controls through the FormGroup during
   submission and check DestroyRef before success/error/navigation callbacks. Its route guard
   confirms dirty, unsubmitted forms; submitted writes remain scoped and settle after navigation.
   New/edit route configurations and the Product ID key reset editor state independently of store.
5. ProductsPage is the concrete single/page-local deletion example. Capture confirmation targets,
   check initiating query identity before callbacks and stop unsent deletes on navigation while
   submitted writes settle. Report partial results, retain failed-row selection for retry and
   reconcile server totals once per batch. Selection resets on query changes and prunes on reads;
   successful deletes stay removed if refresh fails. Do not generalize permanent sequential
   deletion to another domain's transactional or referenced-deletion rules.
6. Use the concrete Angular [Products/editor](../../../apps/admin/src/app/features/products/product-editor.ts)
   and [Reference index](../../../docs/reference.md) for URL filters, typed/dirty forms,
   route-scoped callbacks and upload lifecycle. Preserve domain-specific deletion and ordering
   rules. Follow the Gallery for its three-stage upload and metadata workflow.

## Presentation boundary

The pinned [local Sakai reference](../../../docs/development.md#sakai-source-reference) is
`.references/sakai-ng`. Inspect its original shell components and layout SCSS when comparing
the design. Keep the reference outside application imports and workspace tasks.
Sakai defines the Angular admin's theme, shell and feature presentation. Concrete Angular features
supply domain contracts, validation and scoped request lifecycles. Theme configuration,
local fonts and intentional shell adaptations are described in the linked development guide.

Prefer PrimeNG's documented components and theme tokens before custom presentation code.
Use its MCP metadata for current APIs; never invent inputs or copy APIs from another PrimeUI
library. Keep Sakai as the shell and feature visual reference. Feature styles belong beside their owning
component; global CSS is for the shell, shared base rules and required overlay layout.
Remove replaced styles and unused template demo rules. Extract wrappers only after concrete reuse.

Keep Bulgarian/English text in the catalogs and preserve loading, retry, empty and unavailable
states. A failed refresh can coexist with previously loaded rows, so independent template
conditions are sometimes intentional. Format Angular HTML with the repository's Angular parser.

## Prototype transport

Real and Prototype reuse the same feature components and concrete Apollo services.
Startup config defaults to `graphql`; Angular's `prototype` CLI configuration forces `mock`.
Follow [Angular Prototype](../../../docs/development.md#angular-prototype) and the owning
`apps/admin/src/app/mocks` modules. Keep mode decisions in transport infrastructure.
Stores/Products/Venues/Speakers/Tags/Events/Sessions/Media/History operations are mocked.
Keep exact generated document matching, same-origin transport, active/trashed relation checks,
disposable snapshot validation and visible storage errors. Mutation/History writes are atomic.
Media stores finalized Blobs in native IndexedDB before metadata, rechecks Event/Reset after
awaits and prunes orphan bytes at startup/Reset. Preserve ephemeral capabilities and retained
Trash/Restore files; never claim Sharp or cross-tab parity. Confirmed Reset drains all submitted writes, including
retired captured clients, before replacing fixtures and all client/form state in the same locale.
Use `angular-prototype.smoke.spec.mts`, `angular-prototype-events.smoke.spec.mts` and
`angular-prototype-media.smoke.spec.mts` with the compiled Angular fixture's `mock` option;
it starts no backend/database. Real browser checks still require their dedicated DB setup.

## Local UI catalog

[UiCatalog](../../../apps/admin/src/app/features/prototype/ui-catalog/ui-catalog.ts) is
lazy and Prototype-only. Preserve the `canMatch` gate before loading, discovered-store keys,
URL-selected tabs and section/store/language resets. Body/Lists/Forms/States own local signals
and typed Reactive Forms using native PrimeNG/Sakai presentation. Do not add business services,
fixture imports, persistence or another data provider. Catalog feedback describes local examples.

## Focused verification

Use [holita-focused-validation](../holita-focused-validation/SKILL.md) and native selectors:

- Apollo/cache/retired mutations: `npm run test:admin -- --include=app/features/products/products-api.spec.ts --skip-nx-cache`.
- List URL/filters/sorting/debounce: `npm run test:admin -- --include=app/features/products/products-page.spec.ts --skip-nx-cache`.
- Editor validation/guards/late callbacks: `npm run test:admin -- --include=app/features/products/product-editor.spec.ts --skip-nx-cache`.
- Deletion/partial results/query retirement/client shutdown: `npm run test:admin -- --include=app/features/products/products-deletion.spec.ts --skip-nx-cache`.
- Store/language routing: `npm run test:admin -- --include=app/features/stores/store-workspace.spec.ts --skip-nx-cache`.
- Transport diagnostics/deadline: `npm run test:admin -- --include=app/core/graphql/graphql-options.spec.ts --skip-nx-cache`.
- Real transport and A → B → A: `npm run test:smoke:admin -- angular-foundation.smoke.spec.mts`.
- Shell/keyboard/theme/mobile: `npm run test:smoke:admin -- angular-shell.smoke.spec.mts`.
- Real list paging/filter/sort/history: `npm run test:smoke:admin -- angular-products-list.smoke.spec.mts`.
- Real create/edit/conflicts/dirty navigation: `npm run test:smoke:admin -- angular-product-editor.smoke.spec.mts`.
- Reference boundary, Venues, Speakers and Tags: `npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --skip-nx-cache`; real CRUD/nullable sorting/referenced failures/scoping/disabled/mobile: `npm run test:smoke:admin -- angular-venues.smoke.spec.mts angular-lookups.smoke.spec.mts`.
- Events fields/ranges/time/HTML/scoping: `npm run test:admin -- --include="app/features/reference/events/*.spec.ts" --include=app/features/reference/relation-picker.spec.ts --skip-nx-cache`; real persistence/relations/rich text/URL/columns/dirty and mobile themes: `npm run test:smoke:admin -- angular-events.smoke.spec.mts`.
- Event atomic status/Trash/Restore, reserved Code/children, read-only Trash, paginated plain-text History and delayed actions: `npm run test:smoke:admin -- angular-lifecycle.smoke.spec.mts`.
- Sessions real CRUD/bounds/Speakers/order/conflicts/History/retirement/Sakai: `npm run test:smoke:admin -- angular-sessions.smoke.spec.mts`; controlled API/editor/validation: `npm run test:admin -- --include="app/features/reference/sessions/*.spec.ts" --skip-nx-cache`.
- Gallery captured API/headers/retirement/typed Alt text: `npm run test:admin -- --include=app/features/reference/media/media-api.spec.ts --skip-nx-cache`; real bytes/cancellation/finalization/order/previews/Trash/Sakai: `npm run test:smoke:admin -- angular-media.smoke.spec.mts`.
- Catalog local previews/routing: `npm run test:admin -- --include="app/features/prototype/ui-catalog/*.spec.ts" --skip-nx-cache`; compiled local interactions/Real rejection/mobile/themes: `npm run test:smoke:admin -- angular-ui-catalog.smoke.spec.mts`.
- Real deletion/failed-row retry/last-page correction/keyboard: `npm run test:smoke:admin -- angular-products-delete.smoke.spec.mts`.

Run the relevant type/build checks; root tooling changes also require root lint/typecheck/build.
MCP usage validation does not prove Angular compilation or browser behavior. Keep controlled-HTTP,
real Gateway and visual evidence distinct. Update the existing authoritative docs for changed
behavior, and report actual test counts and remaining limitations. Do not start another feature
or run full regression without the requested scope.
