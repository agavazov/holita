# Documentation

The repository has two distinct domains with separate documentation and contributor instructions:

| Domain                    | Documentation                         | Current implementation                                               |
| ------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Discocan: fleet telemetry | [docs/discocan](discocan/README.md)   | Fleet Vehicles/Devices and the telemetry Angular admin               |
| Ecommerce: online stores  | [docs/ecommerce](ecommerce/README.md) | Core Tenant/Store foundation; no storefront, catalog, cart or orders |

Discocan currently reuses Stores as its organizational scope. In that domain, Stores will
later become Branches. Ecommerce retains Stores for online shops. The current code, APIs,
routes and persistence still use Store/storeId/x-store-id.

## Shared workspace

- [Foundation requirements](req/foundation.md): implemented shared infrastructure and contracts.
- [Architecture](architecture/overview.md): applications, execution and ownership boundaries.
- [Development](development.md): installation, configuration, ports and local commands.
- [Testing](testing.md): focused checks, affected CI and manual regression.
- [Workspace decision](architecture/decisions/0001-npm-workspaces-and-nx.md).
- [Database ownership](architecture/decisions/0002-database-ownership.md).
- [Schema-first federation](architecture/decisions/0003-schema-first-federation.md).
- [Contributor rules](../AGENTS.md).
- [Backend skill](../.agents/skills/holita-backend-feature/SKILL.md).
- [Angular admin skill](../.agents/skills/holita-admin-development/SKILL.md).
- [Focused validation skill](../.agents/skills/holita-focused-validation/SKILL.md).
- [Sakai source and Angular agent tools](development.md#sakai-source-reference).

Choose the domain before reading or updating its documentation. Shared tooling remains in
this directory; business behavior belongs in its domain directory. The requested future
Store-to-Branch terminology is explicitly marked; other product descriptions cover implemented behavior.
