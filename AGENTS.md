# holita coding guide

Also read `AGENTS.local.md` at the repository root if it exists. This optional,
Git-ignored file holds instructions specific to the local checkout, including
local credential locations. Its absence is normal and must not block work.
Keep shared rules in this guide and never put credential values in agent instructions.

## Delivery policy

holita is an internal test release. Deliver what was asked quickly and correctly. This policy
overrides more detailed guidance in documentation and skills.

- Make the smallest change that solves the task. Add no speculative hardening, such as race
  windows, late callbacks, exhaustive edge cases or defensive bounds, unless the user asks or a
  real defect was observed.
- Tests are a budget, not a goal. The repository keeps at most **60** test cases, enforced by
  `npm run test:budget`. Raising the budget requires the owner's explicit approval.
  - Add or extend a test only for:
    - a defect that actually happened;
    - Tenant/Branch isolation;
    - raw SQL;
    - irreversible device writes;
    - a cross-service contract.
  - Prefer extending an existing case. Write one case per `it`/`test` with an internal table.
    Never use `it.each`, `test.each` or `describe.each`.
  - A review finding alone never justifies a new test. Do not test UI wiring, rendering,
    translations, 1:1 mappings or mocks.
- Run no checks while writing. Check once, when you hand over the task (see
  [Verification](#verification)).
- Update documentation only when setup, configuration, a public contract (SDL, operations,
  environment) or a user workflow changes. Do not describe internal behavior that the code
  already shows.
- Report briefly: what changed, which checks ran (command and result), and what was not
  verified.
- Do not re-grow what was deliberately removed: tests, test suites, rules, documentation or
  verification steps. If something seems missing, propose it to the user instead of adding it.

## Product identity

- The repository, current packages and infrastructure resources are named `holita`.
  Discocan and Ecommerce identify the separate domains documented below.
- `red.bg` is a temporary domain used to present the service. It is not the product,
  package, namespace or infrastructure name. Preserve it only when it refers to the
  actual domain or a required compatibility reference.
- Use `holita` / `@holita/*` / `holita_*` for product labels, packages and resource
  names. Preserve legacy identifiers only in explicit migration/rollback guidance and
  historical local artifacts.
- Rename existing resources together with their configuration and documentation. Preserve
  data, credentials and applied migration history. A Compose project rename must not silently
  switch to an empty volume. The user will rename the repository itself separately.

## Domain boundaries and instruction routing

- This repository supports two distinct domains: Discocan (fleet telemetry) and Ecommerce
  (online shops). Documentation separation does not rename current holita packages or resources.
- For telemetry, Vehicles/Devices and the current Fleet admin, read the
  [Discocan documentation](docs/discocan/README.md) and apply the
  [Discocan instructions](docs/discocan/instructions.md).
- For online shops and Core Branch behavior, read the
  [Ecommerce documentation](docs/ecommerce/README.md) and apply the
  [Ecommerce instructions](docs/ecommerce/instructions.md). When a shared Branch change affects
  Fleet, consult both domains.
- Branch is the shared organizational scope in both domains: an online shop in Ecommerce
  and a vehicle fleet in Discocan.
  - Use Branch/branchId/x-branch-id consistently and preserve tenant-scoped access.
  - Where tenantId and branchId both exist, keep branchId immediately after tenantId.
  - Domain terminology does not create separate persistence models.

## General

- Follow the existing architecture and standard framework conventions.
- Prefer the smallest change that fully solves the current task.
- Do not perform unrelated refactors.
- Do not add dependencies without a concrete current need.
- Do not add abstractions for hypothetical future requirements.
- Keep code explicit and readable; avoid clever or generic indirection.
- Do not use `any`, `@ts-ignore`, `@ts-nocheck`, unsafe casts, or lint suppressions.
- Keep code identifiers, translation keys, comments, documentation, and agent instructions in
  English. Admin UI and frontend messages use the supported Bulgarian/English translation catalogs.
- Inspect Git status before editing and preserve unrelated changes. Do not commit, push, merge,
  or open a PR unless the user explicitly requests it.

## Repository

- Use npm workspaces, the existing lockfile, and Nx.
  - The five applications are `apps/admin`, `apps/gateway`, `apps/core`, `apps/fleet` and
    `apps/karma-client`.
- Do not import another application's implementation, Prisma client or database model, including
  through relative paths. ESLint/Nx enforce application boundaries.
- Expose daily commands through root npm scripts. Do not add another build system, a custom
  process supervisor or a custom test-selection framework.
  - The development-only admin Storybook (`@storybook/angular-vite` in
    `apps/admin/angular.json`) is the one documented exception. It never builds application
    output.
  - Add shared packages only for demonstrated current reuse.
- Applications run on the host.
  - Angular and the subgraphs use Node.js. Gateway runs only the official native Apollo Router
    in `apps/gateway/router`.
  - PostgreSQL is the only containerized infrastructure.
  - Never reset databases or remove volumes to fix setup.
- Keep configuration at the narrowest sensible scope and avoid duplicating root tooling.
- Never commit environment files, local database files, build output, coverage, Nx caches, or
  generated Prisma/GraphQL clients.
- Keep the project-local `.credentials/` directory ignored by Git and excluded from
  repository-wide searches, scans and tooling.
  - Use the credential locations in `AGENTS.local.md`. Read only the inventory, service README and
    credential files the current authorized task needs.
  - Never print credential values or put them in documentation, examples, agent instructions or
    command-line arguments.
- Keep one environment reference at the root: `.env.example`, with descriptions, consumers, safe
  examples and `@env-spec` style type/sensitivity annotations.
  - Do not add `.env.schema` or application-local environment examples.
  - Update this reference when environment configuration changes.
- Do not enter, open, read, list, search or modify the repository's `.tmp/` or `.misc/` directories
  unless the user explicitly asks in the current task. They hold temporary files and reference
  projects.
  - The user's authorization applies only to the requested directory or files.
  - Exclude both from repository-wide searches and scans, even if Git tracks files there.

## Documentation

- Start with [docs/README.md](docs/README.md). Read only the documentation the task needs; the
  code is the reference for behavior details.
- Update documentation only as the [delivery policy](#delivery-policy) says.
  - Update the existing authoritative document instead of adding another description.
  - Document only what is implemented.
  - Plans and pending work belong in the [project backlog](docs/todo/README.md).
- Keep [README.md](README.md) accurate for installation and use,
  [architecture](docs/architecture/overview.md) for modules and execution,
  [development](docs/development.md) for configuration and [testing](docs/testing.md) for
  validation.
- Remove obsolete guidance and fix references when moving or deleting documents. Use
  repository-relative Markdown links.
- Keep images outside `.agents/`. Temporary review captures belong in the Git-ignored
  `.references/review/`; do not commit them or make documentation depend on them.
- Report check results in the task response, not in documentation. Do not store credentials or
  private transcripts.
- Shared mandatory rules live here, domain rules in the linked domain instructions and focused
  procedures in the skills. `CLAUDE.md` imports this guide.
- When the user authorizes a checkpoint in `.tmp/`, update it with progress, exact check results
  and next steps.
- Skills:
  - [validation](.agents/skills/holita-focused-validation/SKILL.md)
  - [backend](.agents/skills/holita-backend-feature/SKILL.md)
  - [Angular admin](.agents/skills/holita-admin-development/SKILL.md)
  - [admin design system](.agents/skills/holita-admin-design-system/SKILL.md)

## Project backlog

- Use [docs/todo/](docs/todo/README.md) only for pending work and planned tasks.
- Put short, one-line tasks in `docs/todo/_instant-tsks.md` and larger plans in a descriptive
  Markdown file under `docs/todo/`. Link to an existing component backlog instead of
  duplicating it.
- Write entries in English, and keep proposals distinct from implemented behavior.
- When work is complete, remove its entry. Remove or replace cancelled or superseded entries.

## NestJS

- Organize backend code by feature module.
- Keep controllers thin: HTTP concerns and delegation only.
- Put application and business logic in services.
- Use concrete feature repositories for Prisma operations with compulsory verified Tenant/domain
  scoping. Do not add generic repositories/services, CQRS, empty domain layers, or interfaces for
  every class.
- For GraphQL features, SDL defines the API. Use generated API types and explicit runtime
  validation rather than duplicate handwritten API models. Prisma owns persistence definitions.
- After SDL or operation changes, run codegen and schema:check. Keep generator inputs explicit,
  generated outputs ignored and runtime SDL assets in builds.
- The explicit tenant demo login is development-only; never treat it as production
  authentication.
  - Tenant identity comes from the verified session, never from a caller-supplied tenant header
    or input.
  - Branch context is not authorization.
  - Do not log secrets.
- Keep Prisma schemas, migrations and clients inside the owning service.
  - Review new migration SQL.
  - Never edit applied migrations or replace history with db push.
  - Seeds insert missing fixtures without updating existing rows.
- Use standard NestJS exceptions and avoid custom exception frameworks.

## Angular admin (apps/admin)

- Meridian is visual inspiration only. Do not copy its source, assets or dependencies into holita.
- Never read, print or commit `apps/admin/public/config.local.json`.
- Follow the official [angular-developer](.agents/skills/angular-developer/SKILL.md) skill for
  framework conventions, and the PrimeNG plugin/MCP for current component APIs.
  [Agent setup](docs/development.md#angular-agent-tools) is documented separately.
- Keep standalone Angular and Component → concrete feature service → Apollo with generated
  TypedDocumentNodes through Gateway.
  - Business editors use typed Reactive Forms.
  - Do not add generic CRUD, facades, repositories, duplicate API models or duplicate business
    screens.
- Admin stories and fixtures stay out of application code; the tsconfig exclusion and ESLint
  enforce it.
- The current Vehicles/Devices presentation, navigation and workspace lifecycle belong to
  Discocan. Apply the [Discocan instructions](docs/discocan/instructions.md#angular-admin-appsadmin)
  for this admin, and do not transfer its Fleet workflows to Ecommerce.

## Architectural changes

Before a significant architectural change:

1. Explain the concrete problem.
2. Explain why the current architecture cannot solve it.
3. Propose the smallest sufficient change.

Do not make architectural changes solely because they may be useful later.

## Verification

[docs/testing.md](docs/testing.md) has the commands.

1. **While writing:** run no checks. A failing spec you are fixing may be rerun on its own.
2. **When handing over the task:** run `npm run check` once and fix what it reports.
   - It builds, unit-tests and DB-tests only the projects the change affects, in parallel and from
     the Nx cache. The build is the type check.
   - DB results are cached only locally. `test:core:db`, `test:fleet:db`, CI (`test:affected`) and
     `test:full` always run them fresh.
   - It lints only the files changed since the last check.
   - Also run one browser smoke file when login, routing, transport or a main journey changed.
   - Also run `npm run typecheck:tools` when `tools/` changed.
3. **Only on request:** the whole smoke suite, the federation suite (`test:gateway:db`),
   `test:full` and Storybook review.

CI runs the complete affected checks: lint, typecheck, build, unit, DB, federation and smoke.

Rules for every check:

- Do not pass `--skip-nx-cache` by default. Use it only to re-run a cached result you doubt.
- When you run a single spec, read the executed count: zero tests is not a pass. Do not use watch
  mode or `--passWithNoTests`.
- Database checks, including those in `npm run check`, use only the dedicated test databases
  (`db:up`, `db:test:setup`) and the guarded per-run schema helpers. Never reset databases, remove
  volumes or reuse development connections.
- Run Nx checks one at a time per checkout. Several of them regenerate the GraphQL clients.
- Read summaries instead of full test output, or run long checks in a subagent.
- Keep [PR CI](.github/workflows/affected.yml) on the real event base/head commits.
  [Full regression](.github/workflows/full-regression.yml) stays `workflow_dispatch` only.
- Report the actual commands, their results and any unverified work.
  - Do not declare work complete while a required check fails.
  - Clean up the processes and connections the task started.
