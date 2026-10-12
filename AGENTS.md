# holita coding guide

## Product identity

- The repository, current packages and infrastructure resources are named `holita`.
  Discocan and Ecommerce identify the separate domains documented below.
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

## Domain boundaries and instruction routing

- This repository supports two distinct domains: Discocan (fleet telemetry) and Ecommerce
  (online stores). Documentation separation does not rename current holita packages or resources.
- For telemetry, Vehicles/Devices and the current Fleet admin, read
  [Discocan documentation](docs/discocan/README.md) and apply
  [Discocan instructions](docs/discocan/instructions.md).
- For online stores and Core Store behavior, read [Ecommerce documentation](docs/ecommerce/README.md)
  and apply [Ecommerce instructions](docs/ecommerce/instructions.md). When a shared Store change
  affects Fleet, consult both domains.
- Discocan currently uses Stores as organizational scope; these will later become Branches.
  Ecommerce retains Stores for online shops. Until the rename is implemented, preserve actual
  Store/storeId/x-store-id contracts and tenant-scoped access. Documentation boundaries alone
  do not authorize a code, API, database or infrastructure rename.
- Keep domain-specific behavior and rules in their own documentation directories. Shared
  architecture, development tooling and validation remain under `docs/`.

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

- Use npm workspaces, the existing lockfile, and Nx. The five applications are `apps/admin`, `apps/gateway`, `apps/core`, `apps/fleet`, and `apps/karma-client`.
- Do not import another application's implementation, Prisma client, or database model, including through relative paths. ESLint/Nx enforce application boundaries.
- Expose daily commands through root npm scripts. Do not add another build system, custom process supervisor, or custom test-selection framework. Add shared packages only for demonstrated current reuse.
- Applications run as Node.js processes on the host. PostgreSQL is the only permitted containerized infrastructure for the foundation. Never reset databases or remove volumes to fix setup.
- Keep configuration at the narrowest sensible scope and avoid duplicating root tooling.
- Never commit environment files, local database files, build output, coverage, Nx caches, or generated Prisma/GraphQL clients.
- Do not enter, open, read, list, or search the repository's `.tmp/` or `.misc/` directories or their contents unless explicitly instructed by the user. They contain temporary files and reference projects and must not be used as default task context. User authorization applies only to the requested directory/files. Exclude both `.tmp/` and `.misc/` from repository-wide searches and scans.

## Documentation

- Start with [docs/README.md](docs/README.md) and read the documentation relevant to the requested task.
- Maintain documentation as part of the same change that affects behavior, architecture, API contracts, configuration, persistence, permissions, or user workflows. Update the existing authoritative document instead of creating a competing description.
- Document only what is implemented and how it works. Keep plans, ideas, milestones, progress statuses, session handoffs, dated implementation reports, and proposed functionality out of product documentation. Discuss planning separately unless the user explicitly requests a separate planning artifact.
- Keep [README.md](README.md) accurate for installation and use, [architecture](docs/architecture/overview.md) for current modules/execution, [development](docs/development.md) for configuration, and [testing](docs/testing.md) for validation.
- Remove obsolete guidance and fix references when moving or deleting documents. Prefer repository-relative Markdown links so documentation works across machines and agents.
- Keep screenshots and other image files outside `.agents/`. Sakai comparison captures belong in Git-ignored `.references/review/`. Do not commit temporary captures or make documentation depend on their presence.
- Verify descriptions against the code. Explain actual limitations and how to run checks; report individual test results in the task response rather than maintaining a test-run journal in documentation. Do not store credentials or private transcripts.
- Keep shared mandatory rules here and domain-specific rules in the linked domain instructions. `CLAUDE.md` imports this guide and follows the same domain routing. Skills provide focused procedures without duplicating the guides.
- When the user authorizes a checkpoint in `.tmp/`, update it with progress, exact check results and next steps after meaningful increments. Keep repository-wide searches outside `.tmp/` and `.misc/`.
- Current validation skill: [.agents/skills/holita-focused-validation/SKILL.md](.agents/skills/holita-focused-validation/SKILL.md).
- Backend reference skill: [.agents/skills/holita-backend-feature/SKILL.md](.agents/skills/holita-backend-feature/SKILL.md).
- Angular admin skill: [.agents/skills/holita-admin-development/SKILL.md](.agents/skills/holita-admin-development/SKILL.md).

## NestJS

- Organize backend code by feature module.
- Keep controllers thin: HTTP concerns and delegation only.
- Put application and business logic in services.
- Use concrete feature repositories for Prisma operations and compulsory verified Tenant/domain scoping. Do not add generic repositories/services, CQRS, empty domain layers, or interfaces for every class.
- For GraphQL features, SDL defines the API. Use generated API types and explicit runtime validation rather than duplicate handwritten API models. Prisma owns persistence definitions.
- After SDL/operation changes run codegen and schema:check. Keep generator inputs explicit, generated outputs ignored, and runtime SDL assets in builds. Regenerate/restart instead of adding dynamic discovery.
- The explicit tenant demo login is development-only; never treat it as production authentication. Tenant identity comes from the verified session, never a caller-supplied tenant header/input. Store context is not authorization. Preserve useful diagnostics without logging secrets.
- Keep Prisma schemas/migrations/clients inside the owning service. Review new migration SQL; never edit applied migrations or replace history with db push. Seeds insert missing fixtures without updating existing rows.
- Use standard NestJS exceptions and avoid custom exception frameworks.

## Angular admin (apps/admin)

- Follow the official [angular-developer](.agents/skills/angular-developer/SKILL.md)
  for framework conventions and the PrimeNG plugin/MCP for current component APIs.
  [Agent setup](docs/development.md#angular-agent-tools) is documented separately.
- Keep standalone Angular and Component → concrete feature service → Apollo with generated
  TypedDocumentNodes through Gateway. Business editors use typed Reactive Forms; do not add
  generic CRUD, facades, repositories, duplicate API models or duplicate business screens.
- Current Vehicles/Devices presentation, navigation and workspace lifecycle belong to Discocan.
  Apply [Discocan instructions](docs/discocan/instructions.md#angular-admin-appsadmin) for this admin;
  do not transfer its Fleet workflows to Ecommerce.

## Architectural changes

Before a significant architectural change:

1. Explain the concrete problem.
2. Explain why the current architecture cannot solve it.
3. Propose the smallest sufficient change.

Do not make architectural changes solely because they may be useful later.

## Verification

Follow [docs/testing.md](docs/testing.md). Start with the narrowest relevant project/file/case and expand only when changes or failures justify it. Use the named `test:core`, `test:gateway`, `test:fleet`, `test:karma-client`, `test:admin` targets with native runner selectors.

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
- Use test:core:db/test:fleet:db for persistence changes. Provision with db:up, db:setup and db:test:setup; use the guarded per-run schema helpers under each service's test directory. Never replace them with development connections, resets or shared truncation.
- Use test:gateway:db -- federation.db.spec.mts for real service-boundary changes. The guarded fixture under tools/graphql owns its processes/schemas; gateway runtime must not acquire database dependencies. Use test:schema for offline contract-tool tests.
- Use test:admin with Angular CLI `--include=app/features/fleet/vehicles/vehicles-api.spec.ts` or `--filter="case name"`; use test:smoke:admin -- angular-foundation.smoke.spec.mts for real Angular routing/transport. Its compiled-app fixture owns dedicated schemas and backend processes.
- Report actual commands/results and unverified work. Do not declare work complete while a required check fails. Clean up task-started processes and connections.
