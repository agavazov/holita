# Workspace coding guide

Also read `AGENTS.local.md` at the repository root if it exists. This optional,
Git-ignored file holds instructions specific to the local checkout, including
local credential locations. Its absence is normal and must not block work.
Keep shared rules in this guide and never put credential values in agent instructions.

## Delivery policy

Both products are internal test releases. Deliver what was asked quickly and correctly. This policy
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

## Products and boundaries

One npm/Nx workspace holds two products and the code they share:

| Folder      | What it is                                               | Rules                                    |
| ----------- | -------------------------------------------------------- | ---------------------------------------- |
| `discocan/` | Fleet telemetry                                          | [discocan/AGENTS.md](discocan/AGENTS.md) |
| `holita/`   | SaaS platform for online shops                           | [holita/AGENTS.md](holita/AGENTS.md)     |
| `osnova/`   | Osnova, the foundation both products use (by extraction) | this guide                               |

- A task belongs to one product. Read that product's `AGENTS.md` first and work only in its
  folder.
- Do not open, list, search or change the other product's folder. Scope repository-wide searches
  and scans to your product folder, `osnova/` and the root.
- Read `osnova/` freely. Change it only when the task says so: a change there reaches both
  products, and its checks cover both.
- Products never import each other. Code that both need moves to `osnova/`; it is never copied.
- `osnova/` imports nothing from a product and holds no product name, route or business rule.
  Products use it only through its package names (`@osnova/*`), never through relative paths, so
  that it can later move to its own repository without changing product code.
- Root files (manifests, lockfile, Nx, ESLint, TypeScript, Jest, Prettier, CI and this guide)
  serve both products. Change them only as far as the task requires.
- Package scopes are `@discocan/*`, `@holita/*` and `@osnova/*`. Keep each product's ports,
  databases, environment and running processes separate, so that either can be split off.
- Branch is the shared organizational scope: a vehicle fleet in Discocan and an online shop in
  Holita.
  - Use Branch/branchId/x-branch-id consistently and preserve tenant-scoped access.
  - Where tenantId and branchId both exist, keep branchId immediately after tenantId.
  - Product terminology does not create separate persistence models.
- Until Core moves to `osnova/`, the Core Tenant/Branch foundation is Discocan's `apps/core`,
  documented in [Branches foundation](docs/branches.md).

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
  - Each product keeps its applications in `<product>/apps/`, its packages in
    `<product>/packages/` and its tooling in `<product>/tools/`.
- Do not import another application's implementation, Prisma client or database model, including
  through relative paths. ESLint/Nx enforce application boundaries.
- Expose daily commands through root npm scripts. Do not add another build system, a custom
  process supervisor or a custom test-selection framework.
  - Add shared packages only for demonstrated current reuse.
- Applications run on the host.
  - Angular and the subgraphs use Node.js. A gateway runs only the official native Apollo Router
    from its `router/` folder.
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

Workspace and Osnova documentation lives in `docs/`; product documentation lives in
`discocan/docs/` and `holita/docs/`.

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
- `docs/archive/` is deprecated reference material. Read it only when the task needs it;
  exclude it from repository-wide documentation updates.
- Remove obsolete guidance and fix references when moving or deleting documents. Use
  repository-relative Markdown links.
- Keep images outside `.agents/`. Temporary review captures belong in the Git-ignored
  `.references/review/`; do not commit them or make documentation depend on them.
- Report check results in the task response, not in documentation. Do not store credentials or
  private transcripts.
- Shared mandatory rules live here, product rules in each product's `AGENTS.md` and focused
  procedures in the skills. Each `CLAUDE.md` imports the `AGENTS.md` beside it.
- When the user authorizes a checkpoint in `.tmp/`, update it with progress, exact check results
  and next steps.
- Skills:
  - [validation](.agents/skills/discocan-focused-validation/SKILL.md)
  - [backend](.agents/skills/discocan-backend-feature/SKILL.md)
  - [Angular admin](.agents/skills/discocan-admin-development/SKILL.md)
  - [admin design system](.agents/skills/discocan-admin-design-system/SKILL.md)

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
- Database identifiers are camelCase. Map models and enum types with `@@map` and enum values
  with `@map`, keeping TypeScript and GraphQL names unchanged.
- Keep Prisma schemas, migrations and clients inside the owning service.
  - Review new migration SQL.
  - Never edit applied migrations or replace history with db push.
  - Seeds insert missing fixtures without updating existing rows.
- Use standard NestJS exceptions and avoid custom exception frameworks.

## Angular applications

- Meridian is visual inspiration only. Do not copy its source, assets or dependencies into this
  repository.
- Never read, print or commit an application's `public/config.local.json`.
- Every operator screen uses the one [design system](docs/admin-design-system.md). Add no
  application-local colours, spacing or copies of a shared pattern. When a pattern lacks an
  override point, add it to the pattern instead of forking the pattern.
- Follow the official [angular-developer](.agents/skills/angular-developer/SKILL.md) skill for
  framework conventions, and the PrimeNG plugin/MCP for current component APIs.
  [Agent setup](docs/development.md#angular-agent-tools) is documented separately.
- Keep standalone Angular and Component → concrete feature service → Apollo with generated
  TypedDocumentNodes through Gateway.
  - Business editors use typed Reactive Forms.
  - Do not add generic CRUD, facades, repositories, duplicate API models or duplicate business
    screens.
- Product screens, navigation and workflows stay in their product; only presentation is shared.

## Architectural changes

Before a significant architectural change:

1. Explain the concrete problem.
2. Explain why the current architecture cannot solve it.
3. Propose the smallest sufficient change.

Do not make architectural changes solely because they may be useful later.

## Verification

[docs/testing.md](docs/testing.md) is the authoritative check reference.

- While writing, run no checks. A failing spec you are fixing may be rerun on its own.
- When handing over, run `npm run check` once and fix what it reports, plus the additions in
  [testing](docs/testing.md): one smoke file for login, routing, transport or a main journey,
  and `npm run typecheck:tools` for `discocan/tools/` changes.
- Only on request: the whole smoke suite, `test:gateway:db`, `test:full`.
- Database checks use only the dedicated test databases and guarded helpers. Never reset databases,
  remove volumes or reuse development connections.
- Run Nx checks one at a time per checkout.
- Zero executed tests is not a pass. Do not use watch mode or `--passWithNoTests`; use
  `--skip-nx-cache` only to re-run a cached result you doubt.
- Report the actual commands, results and unverified work. Never declare work complete while a
  required check fails. Clean up the processes and connections the task started.
