# Documentation

The Angular admin in `apps/admin` uses Sakai with holita branding. Start with its
[architecture](architecture/overview.md#angular-admin-foundation),
[local source and theme setup](development.md#sakai-source-reference) and
[validation](testing.md#angular-admin-checks).

- [Workspace requirements](req/foundation.md): stable IDs and acceptance criteria for the implemented foundation.
- [Architecture](architecture/overview.md): application boundaries and current execution.
- [Development](development.md): installation, commands, ports and troubleshooting.
- [Testing](testing.md): focused selection, PR affected CI and manually triggered full regression.
- [CRUD and Reference implementation index](reference.md): Angular Stores/Products/Venues/Speakers/Tags/Vehicles/Devices/Events, Event Sessions and Gallery, and domain examples for relations, uploads, lifecycle and disabled mode.
- [Workspace decision](architecture/decisions/0001-npm-workspaces-and-nx.md): why Nx complements npm.
- [Database ownership](architecture/decisions/0002-database-ownership.md): separate databases and isolated test schemas.
- [Schema-first federation](architecture/decisions/0003-schema-first-federation.md): local contracts, generation and service communication.
- [Contributor rules](../AGENTS.md): mandatory coding and verification instructions.
- [Backend reference skill](../.agents/skills/holita-backend-feature/SKILL.md): extend the actual Products API and persistence.
- [Angular foundation](architecture/overview.md#angular-admin-foundation): PrimeNG/Sakai shell, real Stores/Products/Venues/Speakers/Tags/Events, Event Sessions and Gallery, per-workspace Apollo and [focused checks](testing.md#angular-admin-checks).
- [Local Sakai source](development.md#sakai-source-reference): pinned, Git-ignored template and assets used for layout and visual comparison.
- [Angular admin skill](../.agents/skills/holita-admin-development/SKILL.md): Holita contracts,
  store/route lifecycle and validation, using the [official agent tools](development.md#angular-agent-tools).
- [Focused validation skill](../.agents/skills/holita-focused-validation/SKILL.md): choose and report the relevant checks.

Product documentation describes current behavior. Working plans and progress belong in
the local task checkpoint when the user authorizes one.
