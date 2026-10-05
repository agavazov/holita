---
name: holita-admin-development
description: Review, maintain or extend Holita's Angular admin in apps/admin using the real Apollo Gateway, generated GraphQL contracts and store-scoped client lifecycles. Use for Angular UI, data access and store/route isolation work; not for apps/admin-react or backend implementation.
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
  Aura and the unscoped Stores Apollo client. Runtime endpoint/license configuration is
  loaded before bootstrap; preserve the real Gateway path and keep issued keys out of Git.
- [StoreWorkspace](../../../apps/admin/src/app/features/stores/store-workspace.ts) owns
  discovery and route selection. The URL is the active store/language source. Unknown stores
  cannot start Products requests. Shell components receive inputs and emit selection;
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
- [graphqlOptions](../../../apps/admin/src/app/core/graphql/graphql-options.ts) captures
  store/language in each client transport. Each mounted Products workspace has its own
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
6. When adding CRUD or media behavior, consult the concrete React
   [Products/editor references](../../../docs/reference.md#products-the-aurora-crud-reference)
   and [Reference index](../../../docs/reference.md) for URL filters, dirty forms, route-scoped
   callbacks and upload lifecycle. Preserve behavior without importing React implementation.
   Angular has no upload workflow yet.

## Presentation boundary

The pinned [local Sakai reference](../../../docs/development.md#sakai-source-reference) is
`.references/sakai-ng`. Inspect its original shell components and layout SCSS when comparing
the design. Keep the reference outside application imports and workspace tasks.

Prefer PrimeNG's documented components and theme tokens before custom presentation code.
Use its MCP metadata for current APIs; never invent inputs or copy APIs from another PrimeUI
library. Keep Sakai as the shell/layout reference. Feature styles belong beside their owning
component; global CSS is for the shell, shared base rules and required overlay layout.
Remove replaced styles and unused template demo rules. Extract wrappers only after concrete reuse.

Keep Bulgarian/English text in the catalogs and preserve loading, retry, empty and unavailable
states. A failed refresh can coexist with previously loaded rows, so independent template
conditions are sometimes intentional. Format Angular HTML with the repository's Angular parser.

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
- Real deletion/failed-row retry/last-page correction/keyboard: `npm run test:smoke:admin -- angular-products-delete.smoke.spec.mts`.

Run the relevant type/build checks; root tooling changes also require root lint/typecheck/build.
MCP usage validation does not prove Angular compilation or browser behavior. Keep controlled-HTTP,
real Gateway and visual evidence distinct. Update the existing authoritative docs for changed
behavior, and report actual test counts and remaining limitations. Do not start another feature
or run full regression without the requested scope.
