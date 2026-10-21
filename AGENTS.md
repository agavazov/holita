# holita coding guide

Also read `AGENTS.local.md` at the repository root if it exists. This optional,
Git-ignored file holds instructions specific to the local checkout, including
local credential locations. Its absence is normal and must not block work.
Keep shared rules in this guide and never put credential values in agent instructions.

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
  (online shops). Documentation separation does not rename current holita packages or resources.
- For telemetry, Vehicles/Devices and the current Fleet admin, read
  [Discocan documentation](docs/discocan/README.md) and apply
  [Discocan instructions](docs/discocan/instructions.md).
- For online shops and Core Branch behavior, read [Ecommerce documentation](docs/ecommerce/README.md)
  and apply [Ecommerce instructions](docs/ecommerce/instructions.md). When a shared Branch change
  affects Fleet, consult both domains.
- Branch is the shared organizational scope in both domains: an online shop in Ecommerce
  and a vehicle fleet in Discocan. Use Branch/branchId/x-branch-id consistently and preserve
  tenant-scoped access. Where tenantId and branchId both exist, keep branchId immediately
  after tenantId. Domain terminology does not create separate persistence models.
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
- Expose daily commands through root npm scripts. Do not add another build system, custom process supervisor, or custom test-selection framework. The development-only admin Storybook (`@storybook/angular-vite` targets in `apps/admin/angular.json`) is the one documented exception; it never builds application output. Add shared packages only for demonstrated current reuse.
- Applications run on the host. Angular and the subgraphs use Node.js; Gateway runs only the official native Apollo Router in `apps/gateway/router`. The development group and federation/browser fixtures own their native process lifecycle. PostgreSQL is the only permitted containerized infrastructure for the foundation. Never reset databases or remove volumes to fix setup.
- Keep configuration at the narrowest sensible scope and avoid duplicating root tooling.
- Never commit environment files, local database files, build output, coverage, Nx caches, or generated Prisma/GraphQL clients.
- Keep the project-local `.credentials/` directory ignored by Git and excluded from repository-wide searches, scans and tooling. Use the credential locations in `AGENTS.local.md`, then read only the inventory, service README and credential files needed for the current authorized task. Never print credential values or put them in documentation, examples, agent instructions or command-line arguments.
- Keep one environment reference at the root: `.env.example`, with descriptions, consumers, safe examples and `@env-spec` style type/sensitivity annotations. Do not add `.env.schema` or application-local environment examples. These annotations document the contract; current dotenv/Compose loaders do not enforce them. Update this reference and the relevant documentation when environment configuration changes.
- Do not enter, open, read, list, search or modify the repository's `.tmp/` or `.misc/` directories or their contents unless explicitly instructed by the user in the current task. They contain temporary files and reference projects and must not be used as default task context. User authorization applies only to the requested directory/files. Exclude both `.tmp/` and `.misc/` from repository-wide searches and scans, even if files there are tracked by Git.

## Documentation

- Start with [docs/README.md](docs/README.md) and read the documentation relevant to the requested task.
- Maintain documentation as part of the same change that affects behavior, architecture, API contracts, configuration, persistence, permissions, or user workflows. Update the existing authoritative document instead of creating a competing description.
- Document only what is implemented and how it works. Keep plans, ideas, milestones, progress statuses, session handoffs, dated implementation reports, and proposed functionality out of product documentation. Keep pending work and plans in the separate [project backlog](docs/todo/README.md).
- Keep [README.md](README.md) accurate for installation and use, [architecture](docs/architecture/overview.md) for current modules/execution, [development](docs/development.md) for configuration, and [testing](docs/testing.md) for validation.
- Remove obsolete guidance and fix references when moving or deleting documents. Prefer repository-relative Markdown links so documentation works across machines and agents.
- Keep screenshots and other image files outside `.agents/`. Approved Storybook visual baselines and temporary review captures belong in the Git-ignored `.references/review/`. Do not commit temporary captures or make documentation depend on their presence.
- Verify descriptions against the code. Explain actual limitations and how to run checks; report individual test results in the task response rather than maintaining a test-run journal in documentation. Do not store credentials or private transcripts.
- Keep shared mandatory rules here and domain-specific rules in the linked domain instructions. `CLAUDE.md` imports this guide and follows the same domain routing. Skills provide focused procedures without duplicating the guides.
- When the user authorizes a checkpoint in `.tmp/`, update it with progress, exact check results and next steps after meaningful increments. Keep repository-wide searches outside `.tmp/` and `.misc/`.
- Current validation skill: [.agents/skills/holita-focused-validation/SKILL.md](.agents/skills/holita-focused-validation/SKILL.md).
- Backend reference skill: [.agents/skills/holita-backend-feature/SKILL.md](.agents/skills/holita-backend-feature/SKILL.md).
- Angular admin skill: [.agents/skills/holita-admin-development/SKILL.md](.agents/skills/holita-admin-development/SKILL.md).

## Project backlog

- Use [docs/todo/](docs/todo/README.md) for pending work and planned tasks only. Do not use it as a completion log or add entries for work already done.
- Keep short, one-line tasks in `docs/todo/_instant-tsks.md` and larger plans in a descriptive Markdown file under `docs/todo/`. Link to an existing component backlog instead of duplicating its tasks.
- Write entries in English. Keep proposals and unverified assumptions distinct from implemented behavior.
- When work is complete, remove its backlog entry and update the authoritative documentation. Report individual check results in the task response. Remove or replace cancelled or superseded entries.

## NestJS

- Organize backend code by feature module.
- Keep controllers thin: HTTP concerns and delegation only.
- Put application and business logic in services.
- Use concrete feature repositories for Prisma operations and compulsory verified Tenant/domain scoping. Do not add generic repositories/services, CQRS, empty domain layers, or interfaces for every class.
- For GraphQL features, SDL defines the API. Use generated API types and explicit runtime validation rather than duplicate handwritten API models. Prisma owns persistence definitions.
- After SDL/operation changes run codegen and schema:check. Keep generator inputs explicit, generated outputs ignored, and runtime SDL assets in builds. Regenerate/restart instead of adding dynamic discovery.
- The explicit tenant demo login is development-only; never treat it as production authentication. Tenant identity comes from the verified session, never a caller-supplied tenant header/input. Branch context is not authorization. Preserve useful diagnostics without logging secrets.
- Keep Prisma schemas/migrations/clients inside the owning service. Review new migration SQL; never edit applied migrations or replace history with db push. Seeds insert missing fixtures without updating existing rows.
- Use standard NestJS exceptions and avoid custom exception frameworks.

## Angular admin (apps/admin)

- Meridian is visual inspiration only. Do not copy its source, assets or dependencies into holita.
- Never read, print or commit `apps/admin/public/config.local.json`.

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
- Admin stories and fixtures stay out of application code (tsconfig exclusion and ESLint enforce it). Use test:visual:admin for presentation changes; its screenshots are candidates until a person approves them. Never update visual baselines without that approval.
- Report actual commands/results and unverified work. Do not declare work complete while a required check fails. Clean up task-started processes and connections.
