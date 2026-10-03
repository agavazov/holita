# Documentation

- [Workspace requirements](req/foundation.md): stable IDs and acceptance criteria for the implemented foundation.
- [Architecture](architecture/overview.md): application boundaries and current execution.
- [Development](development.md): installation, commands, ports and troubleshooting.
- [Testing](testing.md): focused selection, PR affected CI and manually triggered full regression.
- [CRUD and Reference implementation index](reference.md): UI catalog/shared component inventory, Products Aurora state boundaries, plus domain examples for relations, uploads, lifecycle and disabled mode.
- [Workspace decision](architecture/decisions/0001-npm-workspaces-and-nx.md): why Nx complements npm.
- [Database ownership](architecture/decisions/0002-database-ownership.md): separate databases and isolated test schemas.
- [Schema-first federation](architecture/decisions/0003-schema-first-federation.md): local contracts, generation and service communication.
- [Contributor rules](../AGENTS.md): mandatory coding and verification instructions.
- [Backend reference skill](../.agents/skills/holita-backend-feature/SKILL.md): extend the actual Products API and persistence.
- [Admin reference skill](../.agents/skills/holita-admin-feature/SKILL.md): extend the actual Products UI and store lifecycle.
- [Focused validation skill](../.agents/skills/holita-focused-validation/SKILL.md): choose and report the relevant checks.

For Prototype work, start with [installation](development.md#prerequisites-and-installation),
[starting the admin](development.md#admin-data-modes),
[manual review](development.md#manual-prototype-review) and
[automated checks](testing.md#prototype-checks). These paths do not require a backend or database.

Product documentation describes current behavior. Working plans and progress belong in
the local task checkpoint when the user authorizes one.
