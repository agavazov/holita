# holita coding guide

## Product identity

- The product, codebase and all new resources are named `holita`.
- `red.bg` is a temporary domain used to present the service. It is not the product,
  package, namespace or infrastructure name. Preserve it only when it refers to the
  actual domain or a required compatibility reference.
- Use `holita` / `@holita/*` / `holita_*` for product labels, packages and resource
  names as appropriate. Preserve legacy identifiers only in explicit migration/rollback
  guidance and historical local artifacts.
- Rename existing resources together with their configuration, documentation and
  tests. Preserve data, credentials and applied migration history. A Compose project
  rename must not silently switch to an empty volume; plan and verify the data
  transition explicitly. The user will rename the repository itself separately.

## General

- Follow the existing architecture and standard framework conventions.
- Prefer the smallest change that fully solves the current task.
- Do not perform unrelated refactors.
- Do not add dependencies without a concrete current need.
- Do not add abstractions for hypothetical future requirements.
- Keep code explicit and readable; avoid clever or generic indirection.
- Do not use `any`, `@ts-ignore`, `@ts-nocheck`, unsafe casts, or lint suppressions.
- Keep code identifiers, translation keys, comments, documentation, and agent instructions in English. Admin UI and frontend messages use the supported Bulgarian/English translation catalogs.
- Inspect Git status before editing and preserve unrelated changes. Do not commit, push, merge, or open a PR unless the user explicitly requests it.

## Repository

- Use npm workspaces, the existing lockfile, and Nx. The six applications are `apps/admin`, `apps/admin-react`, `apps/gateway`, `apps/core`, `apps/products`, and `apps/reference`.
- Do not import another application's implementation, Prisma client, or database model, including through relative paths. ESLint/Nx enforce application boundaries.
- Expose daily commands through root npm scripts. Do not add another build system, custom process supervisor, or custom test-selection framework. Add shared packages only for demonstrated current reuse.
- Applications run as Node.js processes on the host. PostgreSQL is the only permitted containerized infrastructure for the foundation. Never reset databases or remove volumes to fix setup.
- Keep configuration at the narrowest sensible scope and avoid duplicating root tooling.
- Never commit environment files, local database files, build output, coverage, Nx caches, or generated Prisma/GraphQL clients.
- Do not open, read, list, or search the repository's `.tmp/` directory or its contents unless explicitly instructed by the user. It contains unrelated or unnecessary code and resources, so do not use it as default task context. Exclude `.tmp/` from repository-wide searches and scans.

## Documentation

- Start with [docs/README.md](docs/README.md) and read the documentation relevant to the requested task.
- Maintain documentation as part of the same change that affects behavior, architecture, API contracts, configuration, persistence, permissions, or user workflows. Update the existing authoritative document instead of creating a competing description.
- Document only what is implemented and how it works. Keep plans, ideas, milestones, progress statuses, session handoffs, dated implementation reports, and proposed functionality out of product documentation. Discuss planning separately unless the user explicitly requests a separate planning artifact.
- Keep [README.md](README.md) accurate for installation and use, [architecture](docs/architecture/overview.md) for current modules/execution, [development](docs/development.md) for configuration, and [testing](docs/testing.md) for validation.
- Remove obsolete guidance and fix references when moving or deleting documents. Prefer repository-relative Markdown links so documentation works across machines and agents.
- Keep screenshots and other image files outside `.agents/`. Aurora review captures and metadata are temporary local files in Git-ignored `artifacts/aurora/`. Delete them after visual acceptance or when requested; do not commit them or make documentation depend on their presence.
- Verify descriptions against the code. Explain actual limitations and how to run checks; report individual test results in the task response rather than maintaining a test-run journal in documentation. Do not store credentials or private transcripts.
- Keep mandatory rules here. `CLAUDE.md` imports this guide. Skills provide focused procedures without duplicating the entire guide.
- When the user authorizes a checkpoint in `.tmp/`, update it with progress, exact check results and next steps after meaningful increments. Keep repository-wide searches outside `.tmp/`.
- Current validation skill: [.agents/skills/holita-focused-validation/SKILL.md](.agents/skills/holita-focused-validation/SKILL.md).
- Backend reference skill: [.agents/skills/holita-backend-feature/SKILL.md](.agents/skills/holita-backend-feature/SKILL.md).
- Admin reference skill: [.agents/skills/holita-admin-feature/SKILL.md](.agents/skills/holita-admin-feature/SKILL.md).

## NestJS

- Organize backend code by feature module.
- Keep controllers thin: HTTP concerns and delegation only.
- Put application and business logic in services.
- Use concrete feature repositories for Prisma operations and compulsory store scoping. Do not add generic repositories/services, CQRS, empty domain layers, or interfaces for every class.
- For GraphQL features, SDL defines the API. Use generated API types and explicit runtime validation rather than duplicate handwritten API models. Prisma owns persistence definitions.
- Follow the actual [Products resolver/service/repository](apps/products/src/products/products.resolver.ts) and its [SDL](apps/products/src/products/products.graphql). Use @Parent on a federation reference parameter when combining it with Nest parameter decorators; always resolve Product references through scoped service access.
- After SDL/operation changes run codegen and schema:check. Keep generator inputs explicit, generated outputs ignored, and runtime SDL assets in builds. Regenerate/restart instead of adding dynamic discovery.
- Product persistence must always include the active store. Creation gets store ID from context and checks existence through core. Do not make a store existence network call for every product read/update/delete or move that blanket check into the gateway.
- Do not implement fake authentication or treat store context as authorization. Preserve useful diagnostics without logging secrets.
- Keep Prisma schemas/migrations/clients inside the owning service. Review new migration SQL; never edit applied migrations or replace history with db push. Seeds insert missing fixtures without updating existing rows.
- Use standard NestJS exceptions and avoid custom exception frameworks.

## Angular admin (apps/admin)

- Use standalone Angular components, standard routing and signals/RxJS for local query state.
  Keep the flow Component → concrete feature service → Apollo. Do not add generic CRUD,
  repositories, use-case layers or facades without a demonstrated current need.
- Use the existing real gateway and generated TypedDocumentNode operations near their features.
  Do not import React providers, add a Prototype layer or duplicate GraphQL API models.
- Keep store discovery separate from store-scoped Products clients. Each mounted store workspace
  owns its client/cache and captures the store/language in its transport. Never mutate a global
  current-store header or rely on headers alone for cache/query identity.
- Recreate the feature boundary when store/language route parameters change. Dispose its reads;
  retain a retired client only until already submitted mutations settle. Invalidate only the
  captured client's cache. Keep local callbacks and form state within their initiating route.
- Prove A → B → A, delayed reads and mutations settling after navigation with focused tests.
  Preserve admin-react as the behavior reference for CRUD, dirty forms and upload lifecycle.
- The current Angular UI is a minimal real Stores/Products read foundation. Do not add Sakai,
  CRUD forms or another feature until that scope is explicitly requested. Rich text must not
  depend on the deprecated PrimeNG Editor.

## React admin (apps/admin-react)

- Use Refine abstractions where they fit the task.
- Use MUI and the actual Aurora `vite-ts` components for new or migrated admin UI. The local source is `../themes/aurora/vite-ts`. Preserve Aurora's theme, typography, spacing, icons and interaction patterns with holita branding; do not approximate its appearance by restyling existing Ant Design components.
- Use Aurora's simple single-column Sidenav layout without a footer. Show enabled module groups together in one list; do not restore the Stacked group rail or sidebar profile panel. The top bar contains the data mode indicator, search, language, theme, notification and profile controls; module navigation belongs in the sidenav. On mobile, the mode indicator and store selector sit below the top bar.
- Use the Prototype UI catalog and [shared component inventory](docs/reference.md#ui-catalog-and-shared-components) when composing admin UI. Reuse MUI primitives with the existing Aurora overrides and shared presentation components directly. Extract new shared components only from concrete reuse; keep fields, validation, query state and business actions in their owning feature. Keep catalog preview state local to its section, separate from persisted mock resources; examples must not issue business operations or imply a backend capability.
- Keep the layout independent of feature data access and business logic. Supply application navigation, store selection and display data through explicit component inputs. Example search results, notifications and profile data are permitted for the shell; keep them separate from real CRUD data and do not implement fake authentication.
- Integrate and visually review the shell before redesigning module CRUD screens. Keep existing CRUD and store switching operational during this stage; begin module redesign only after explicit user acceptance of the shell.
- For migrated CRUD, reuse Aurora's Invoice breadcrumb/title/primary-action header, Member list/menu/selection/filter patterns, and Create Event form composition. Include at most three useful secondary header actions. Filters apply on change, with a short debounce for text; record clicks normally open a full-page editor.
- Use a sticky desktop form aside for status, relevant settings and summary; move it below the main fields on mobile. Batch deletion is the shared initial selection action. Add other batch actions only for an explicitly required module capability. Preserve the owning module's deletion rules and report partial failures accurately.
- The admin uses Aurora/MUI throughout; Ant Design and its compatibility providers/styles have been removed. Do not reintroduce them. Remove replaced components and styles after verification. Import only the Aurora components and dependencies required by the current feature, without its demo application or data/authentication providers.
- Keep components focused without splitting trivial markup into separate files.
- Keep data access in the Refine data provider and hooks, not scattered through presentation components.
- Do not add a global state library unless local and Refine state cannot solve a concrete requirement.
- Capture store identity for requests, mutations and cache invalidation. Late results must not affect a newly selected store.
- Follow [ProductForm](apps/admin-react/src/features/products/product-form.tsx), [the editor](apps/admin-react/src/features/products/product-editor.tsx) and [the single data provider](apps/admin-react/src/data/data-provider.ts). Pass the scoped resource at mutation submission; use per-call callbacks for local notifications/navigation so unmounting suppresses obsolete effects.
- Refine owns the cache; the URQL transport has fetchExchange only. Do not use a mutable global store header or rely on headers alone for query identity. Store subtree keys reset forms/pagination/dialogs on switching.
- Keep editor mutation state scoped to its route as well as its store. Changing between create/edit or product IDs must unmount the previous editor so late callbacks cannot affect a newly opened form.
- Products and Reference Events/Venues/Speakers/Tags are the implemented feature examples. Extend the concrete Reference domain for demonstration features; do not add another demo application or a generic CRUD framework.
- Existing Products/Reference examples and skills remain references for contracts, validation and request/store/route lifecycle. Products is the base Aurora/MUI CRUD reference; Reference's Aurora workflows add concrete Event, Session, gallery and history capabilities. Store discovery and unavailable states also follow the selected Aurora preset. Use the [Products reference](docs/reference.md#products-the-aurora-crud-reference) to distinguish shared presentation components from feature-owned state and rules. Verify visual fidelity against the selected Aurora layout at matching desktop and mobile viewport sizes.
- Use the [Reference implementation index](docs/reference.md) to find the concrete Event, Session, media and lifecycle examples and their focused tests. Copy only the capabilities required by the feature.

## React admin data modes and prototype development

- Use the same admin routes, Aurora/MUI components, Refine hooks and single GraphQL data
  provider for Prototype (`mock`) and Real (`graphql`). Select the mode at startup with
  `VITE_DATA_SOURCE`; do not scatter mode checks or fixture imports through feature UI.
- Prototype uses the local MSW transport in `apps/admin-react/src/mocks`. Match generated named
  operation documents and input/result types. Do not bypass Refine with a second CRUD
  provider, a fixture-only screen or direct storage access in feature components.
- Keep prototype business requests on its own origin and reject unsupported operations.
  Never fall through to the real gateway. Add a business screen to Prototype navigation only when
  its required operations are mocked; expose it in Real only when its backend is ready.
  The UI catalog is a Prototype-only presentation resource with local examples and no CRUD API.
- Follow the owning feature's validation, store predicates, filters, pagination, sorting,
  relation/deletion rules and error shapes. Resolve relation labels from current lookup rows
  and enforce referenced deletion through persisted Event/Session links, including Trash.
  Save mutations and their History entries in the same snapshot. Mock tests do not prove
  backend persistence or federation parity.
- Keep concrete mock resource behavior in the Products/Venues/Speakers/Tags/Events/Sessions/Media modules under
  `apps/admin-react/src/mocks`; state owns storage and Reset. Reuse primitive guards, not generic
  CRUD controllers. Preserve omitted/null updates, nullable sort ordering and stable ID ties.
  Both modes reuse the existing Gallery/upload hook. Keep local mock HTTP upload/read
  handlers scoped to the captured intent and current active Event; reject expired capabilities.
- Keep browser data small and versioned. Change the snapshot version when its shape changes;
  discard obsolete demo snapshots instead of building migrations. Report failed storage
  writes. Reset requires confirmation, waits for submitted mutations, restores fixtures
  and clears Refine/form state. Browser prototype data is disposable and is never imported
  into Real. Keep finalized image Blobs in native IndexedDB, never in localStorage.
  Unfinished uploads are ephemeral. Persist bytes before metadata/History, re-read the snapshot
  after async byte writes, and reject Reset/Trash races. Metadata owns accessibility;
  remove logical references before physical cleanup and prune orphan bytes on startup/Reset.
  Preserve finalized files through Trash/Restore. Do not claim cross-tab or Sharp decoder parity.
- Extend one concrete feature at a time: shared UI and generated operation contract,
  mock behavior and focused tests, then the real backend and real checks. Record current
  availability and limitations in the existing development/architecture/testing documents.
  When the API changes, update mocks and the backend together; do not add fictitious backend
  endpoints merely to make a planned screen visible.

## Architectural changes

Before a significant architectural change:

1. Explain the concrete problem.
2. Explain why the current architecture cannot solve it.
3. Propose the smallest sufficient change.

Do not make architectural changes solely because they may be useful later.

## Verification

Follow [docs/testing.md](docs/testing.md). Start with the narrowest relevant project/file/case and expand only when changes or failures justify it. Use the named `test:core`, `test:products`, `test:gateway`, `test:reference`, `test:admin` and `test:admin-react` targets with native runner selectors.

For tooling changes, run from the repository root, plus relevant focused tests:

```text
npm run lint
npm run typecheck
npm run build
```

- Never run `test:full` automatically during implementation; it requires an explicit user/reviewer request. `npm test` is not the validation interface.
- Do not accept zero executed tests as successful behavioral validation. Do not enable `--passWithNoTests` or watch mode in agent commands.
- Account for untracked files in the current diff and distinguish it from the broader PR diff. Nx affected selects projects, not proof of runtime-contract coverage.
- Keep [PR CI](.github/workflows/affected.yml) on real event base/head commits with explicit missing-history failure. Workflow and ignore-rule changes belong in Nx shared inputs. [Full regression CI](.github/workflows/full-regression.yml) must remain workflow_dispatch only; docs-only selection is not application test coverage.
- Database checks require dedicated test databases; do not reuse cached live-DB results as current evidence.
- Use test:core:db/test:products:db/test:reference:db for persistence changes. Provision with db:up, db:setup and db:test:setup; use the guarded per-run schema helpers under each service's test directory. Never replace them with development connections, resets or shared truncation.
- Use test:gateway:db -- federation.db.spec.mts for real service-boundary changes. The guarded fixture under tools/graphql owns its processes/schemas; gateway runtime must not acquire database dependencies. Use test:schema for offline contract-tool tests.
- Use test:admin with Angular CLI `--include=app/features/products/products-api.spec.ts` or `--filter="case name"`; use test:smoke:admin -- angular-foundation.smoke.spec.mts for real Angular routing/transport. Its compiled-app fixture owns dedicated schemas and backend processes.
- Use test:admin-react with the relevant form/provider/store-workspace file, and test:smoke:admin-react -- products.smoke.spec.mts for browser/store-switch changes. The explicit noncached browser fixture reuses dedicated DB guards and closes its own Vite/backend processes; never substitute development databases.
- Report actual commands/results and unverified work. Do not declare work complete while a required check fails. Clean up task-started processes and connections.
