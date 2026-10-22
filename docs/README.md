# Documentation

The repository has two distinct domains with separate documentation and contributor instructions:

| Domain                    | Documentation                         | Current implementation                                                                            |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Discocan: fleet telemetry | [docs/discocan](discocan/README.md)   | Fleet master data, telemetry, trips, alerts and service tasks, Karma Client and the Angular admin |
| Ecommerce: online shops   | [docs/ecommerce](ecommerce/README.md) | Core Tenant/Branch foundation; no storefront, catalog, cart or orders                             |

Branch is the shared organizational scope: a vehicle fleet in Discocan and an online shop
in Ecommerce. Code, APIs, routes and persistence use Branch/branchId/x-branch-id with
verified Tenant scope.

## Shared workspace

- [Foundation requirements](req/foundation.md): implemented shared infrastructure and contracts.
- [Architecture](architecture/overview.md): applications, execution and ownership boundaries.
- [Development](development.md): installation, configuration, ports and local commands.
- [Testing](testing.md): the test budget, checks by tier, database, federation and browser smoke
  checks, affected CI and manual regression.
- [Admin design system](admin-design-system.md): theme, global styles, shell, patterns and the
  Storybook review of `apps/admin`.
- [Workspace decision](architecture/decisions/0001-npm-workspaces-and-nx.md).
- [Database ownership](architecture/decisions/0002-database-ownership.md).
- [Schema-first federation](architecture/decisions/0003-schema-first-federation.md).
- [Admin design system decision](architecture/decisions/0004-admin-design-system.md).
- [Fleet list contract and derived values](architecture/decisions/0005-fleet-list-contract-and-derived-values.md).
- [Contributor rules](../AGENTS.md).
- [Backend skill](../.agents/skills/holita-backend-feature/SKILL.md).
- [Angular admin skill](../.agents/skills/holita-admin-development/SKILL.md).
- [Admin design-system skill](../.agents/skills/holita-admin-design-system/SKILL.md).
- [Focused validation skill](../.agents/skills/holita-focused-validation/SKILL.md).
- [Admin Storybook](development.md#admin-storybook) and
  [Angular agent tools](development.md#angular-agent-tools).

Choose the domain before reading or updating its documentation. Shared tooling remains in
this directory; business behavior belongs in its domain directory. Product descriptions
cover implemented behavior.

## Pending work

The [project backlog](todo/README.md) holds open tasks and plans separately from product
documentation. Use [instant tasks](todo/_instant-tsks.md) for short entries and a descriptive
file under `docs/todo/` for larger plans.
