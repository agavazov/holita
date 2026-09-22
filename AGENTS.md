# Holita coding guide

## General

- Follow the existing architecture and standard framework conventions.
- Prefer the smallest change that fully solves the current task.
- Do not perform unrelated refactors.
- Do not add dependencies without a concrete current need.
- Do not add abstractions for hypothetical future requirements.
- Keep code explicit and readable; avoid clever or generic indirection.
- Do not use `any`, `@ts-ignore`, `@ts-nocheck`, unsafe casts, or lint suppressions.

## Repository

- This is an npm-workspaces monorepo with independent applications in `apps/`.
- Do not introduce Nx, Turborepo, a custom build system, or new workspace packages without an approved need.
- Keep configuration at the narrowest sensible scope and avoid duplicating root tooling.
- Never commit environment files, local database files, build output, coverage, or generated Prisma Client files.
- Do not read, list, or search the repository's `.tmp/` directory or its contents unless explicitly instructed by the user. Exclude `.tmp/` from repository-wide searches and scans.

## Documentation

- Start with [docs/README.md](docs/README.md) and read the documentation relevant to the requested task.
- Maintain documentation as part of the same change that affects behavior, architecture, API contracts, configuration, persistence, permissions, or user workflows. Update the existing authoritative document instead of creating a competing description.
- Document only what is implemented and how it works. Keep plans, ideas, milestones, progress statuses, session handoffs, dated implementation reports, and proposed functionality out of product documentation. Discuss planning separately unless the user explicitly requests a separate planning artifact.
- Keep [README.md](README.md) accurate for installation and use, [docs/architecture.md](docs/architecture.md) accurate for modules, data and execution, and [docs/runtime.md](docs/runtime.md) accurate for provider integration, instructions and permissions.
- Remove obsolete guidance and fix references when moving or deleting documents. Prefer repository-relative Markdown links so documentation works across machines and agents.
- Verify descriptions against the code. Explain actual limitations and how to run checks; report individual test results in the task response rather than maintaining a test-run journal in documentation. Do not store credentials or private transcripts.
- Keep this file as the shared contributor guide. `CLAUDE.md` imports it; do not duplicate these rules or inject contributor documentation wholesale into Holita runtime prompts.

## NestJS

- Organize backend code by feature module.
- Keep controllers thin: HTTP concerns and delegation only.
- Put application and business logic in services.
- Access Prisma directly from feature services through `PrismaService`.
- Do not create repository abstractions, handlers, managers, use-case classes, CQRS layers, or generic CRUD bases without a proven requirement.
- Use DTOs with `class-validator` for all external input.
- Use standard NestJS exceptions and avoid custom exception frameworks.

## React

- Use Refine abstractions where they fit the task.
- Use Ant Design controls instead of recreating standard UI primitives.
- Keep components focused without splitting trivial markup into separate files.
- Keep data access in the Refine data provider and hooks, not scattered through presentation components.
- Do not add a global state library unless local and Refine state cannot solve a concrete requirement.

## Architectural changes

Before a significant architectural change:

1. Explain the concrete problem.
2. Explain why the current architecture cannot solve it.
3. Propose the smallest sufficient change.

Do not make architectural changes solely because they may be useful later.

## Verification

After changes, run from the repository root:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Run narrower relevant checks while iterating. Do not declare work complete while a required check fails.
