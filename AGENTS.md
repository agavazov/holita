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

- Use npm workspaces, the existing lockfile, and Nx. The five applications are `apps/admin`, `apps/gateway`, `apps/core`, `apps/products`, and `apps/reference`.
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
- Keep screenshots and other image files outside `.agents/`. Sakai comparison captures belong in Git-ignored `.references/review/`. Do not commit temporary captures or make documentation depend on their presence.
- Verify descriptions against the code. Explain actual limitations and how to run checks; report individual test results in the task response rather than maintaining a test-run journal in documentation. Do not store credentials or private transcripts.
- Keep mandatory rules here. `CLAUDE.md` imports this guide. Skills provide focused procedures without duplicating the entire guide.
- When the user authorizes a checkpoint in `.tmp/`, update it with progress, exact check results and next steps after meaningful increments. Keep repository-wide searches outside `.tmp/`.
- Current validation skill: [.agents/skills/holita-focused-validation/SKILL.md](.agents/skills/holita-focused-validation/SKILL.md).
- Backend reference skill: [.agents/skills/holita-backend-feature/SKILL.md](.agents/skills/holita-backend-feature/SKILL.md).
- Angular admin skill: [.agents/skills/holita-admin-development/SKILL.md](.agents/skills/holita-admin-development/SKILL.md).

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

- Follow [holita-admin-development](.agents/skills/holita-admin-development/SKILL.md) for this
  application and the official [angular-developer](.agents/skills/angular-developer/SKILL.md)
  for framework conventions. Use the official PrimeNG plugin/MCP for current component APIs;
  [installation](docs/development.md#angular-agent-tools) is documented separately.
- Keep standalone Angular and Component → concrete feature service → Apollo with generated
  TypedDocumentNodes. Real uses the actual Gateway; Prototype supplies the implemented mock
  transport. Do not add generic CRUD, facades, repositories, duplicate API models or mode-specific
  business screens. Business editors use typed Reactive Forms.
- Each store/language workspace owns its client/cache and immutable transport scope. Recreate
  the feature boundary on navigation, dispose reads and let submitted writes settle against
  their captured client. Late results, invalidation and callbacks must not affect another workspace.
  Prove A → B → A and delayed reads/writes through the concrete Angular feature tests.
- Prefer PrimeNG components and theme tokens. Sakai supplies the shell/layout reference;
  keep global CSS minimal, feature styles local and remove unused demo rules. Do not add
  wrappers without concrete reuse or depend on the deprecated PrimeNG Editor.
- Sakai is the Angular admin's theme and owns shell/feature visual design and responsive composition. Consult
  the Angular Products/Reference implementation index for contracts, validation and scoped lifecycles.
- Use the pinned local Sakai source in `.references/sakai-ng` for layout comparisons;
  [setup and source paths](docs/development.md#sakai-source-reference) are documented separately.
  It is ignored reference material, not an npm/Nx application or runtime dependency.
- Keep the shell independent of business data access, with explicit inputs/outputs and only
  implemented navigation. Preserve Bulgarian/English catalogs, keyboard/mobile behavior and
  light/dark themes, with focused tests and visual review at matching viewport sizes.
- Angular startup selects Real or Prototype once. Prototype supports Stores/Products/Venues/
  Speakers/Tags/Events/Sessions/Media/History through Angular-owned MSW and the same generated documents, components and
  concrete Apollo services. Keep its endpoint on its own origin, reject unsupported/altered
  operations and Gateway fallback, and preserve versioned snapshots/storage failures. Confirmed
  Reset pauses new writes, drains active/retired submissions and replaces clients/forms in the
  current locale. Media uses native IndexedDB for finalized Blobs, byte-before-metadata writes,
  post-await Event/Reset checks and orphan pruning. Mutations and History share one snapshot
  write; Trash/Restore retain children/files. The lazy Sakai UI catalog is Prototype-only; guard Real before loading,
  gate discovered stores and reset section-local previews on section/store/language navigation.
  Catalog examples use native PrimeNG and typed forms, never business operations or persisted fixtures.
- Angular provides Stores discovery, Products and Reference Venues/Speakers/Tags CRUD with page-local sequential
  deletion. Preserve referenced-Venue failures, partial results, failed-row retry and stopping
  unsent deletes on navigation; submitted writes retain their captured scope. Reference startup
  availability gates navigation and direct routes without business requests. Add another feature
  only when explicitly requested.

- Events has a concrete scoped API, URL-backed filtered list, typed editor and sanitized overview.
  Preserve exact string EUR amounts, untouched Sofia instants, paired registration dates, active
  new assignments and labeled inactive relations. Rich text uses Tiptap core with a typed form
  control boundary and browser/server sanitization. Event Publish/Archive/Trash/Restore use the
  backend's atomic mutation for 1–100 explicit page-local IDs, retaining selection on failure
  and clearing it on query changes. Retire confirmation callbacks when the view changes;
  submitted writes keep their captured client. Trash is read-only; History uses server paging,
  localized labels/Sofia times and plain-text HTML excerpts.
  Do not apply lookup sequential deletion to Events.
- Sessions are Event-scoped concrete CRUD with typed Reactive Forms, plain Summary, nullable Room,
  Sofia instants and remote Speakers. Preserve parent bounds, retained inactive assignments and
  the 100 Session/Speaker limits. Native drag and up/down controls change a local order draft;
  save the complete ID set atomically, retain failed drafts and reload membership on Cancel.
  Dirty ordering blocks child editing and guards navigation. Confirm permanent Session deletion;
  all submitted writes retain their parent/store/client and retire obsolete callbacks. Trash blocks
  child queries; Restore returns the saved program. Mutations refresh the initiating Event/History.

- Event Gallery uses its own captured MediaApi and intent → binary → finalize contract.
  Cancel unfinished transfer on navigation; submitted finalization retains its store/Event and
  retires obsolete feedback. Send only capability headers to the direct upload URL. Preserve
  decoder validation, cover fallback, Alt text/null clearing, confirmed permanent removal,
  complete-set ordering drafts/retry/reloading Cancel, preview focus/renewal and Trash/Restore.
  Gallery writes retain unsaved Event fields; finish/cancel Gallery work before saving them.

## Architectural changes

Before a significant architectural change:

1. Explain the concrete problem.
2. Explain why the current architecture cannot solve it.
3. Propose the smallest sufficient change.

Do not make architectural changes solely because they may be useful later.

## Verification

Follow [docs/testing.md](docs/testing.md). Start with the narrowest relevant project/file/case and expand only when changes or failures justify it. Use the named `test:core`, `test:products`, `test:gateway`, `test:reference`, `test:admin` targets with native runner selectors.

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
- Report actual commands/results and unverified work. Do not declare work complete while a required check fails. Clean up task-started processes and connections.
