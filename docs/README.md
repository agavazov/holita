# Documentation

Workspace and Osnova documentation live in `docs/`; Discocan documentation lives in
[discocan/docs](../discocan/docs/README.md), and Holita documentation lives in `holita/docs/`.
The shared [Core Branch foundation](branches.md) describes the current Tenant/Branch implementation.

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
  design page of `discocan/apps/admin`.
- [Workspace decision](architecture/decisions/0001-npm-workspaces-and-nx.md).
- [Database ownership](architecture/decisions/0002-database-ownership.md).
- [Schema-first federation](architecture/decisions/0003-schema-first-federation.md).
- [Admin design system decision](architecture/decisions/0004-admin-design-system.md).
- [Fleet list contract and derived values](architecture/decisions/0005-fleet-list-contract-and-derived-values.md).
- [ERM device server](architecture/decisions/0006-erm-device-server.md).
- [ERM gateway and API processes](architecture/decisions/0007-erm-gateway-and-api-processes.md).
- [ERM telemetry into Fleet activity](architecture/decisions/0008-erm-telemetry-into-fleet-activity.md).
- [Device types and adapters](architecture/decisions/0009-device-types-and-adapters.md).
- [Contributor rules](../AGENTS.md).
- [Backend skill](../.agents/skills/osnova-backend-feature/SKILL.md).
- [Angular admin skill](../.agents/skills/osnova-admin-development/SKILL.md).
- [Admin design-system skill](../.agents/skills/osnova-admin-design-system/SKILL.md).
- [Focused validation skill](../.agents/skills/osnova-focused-validation/SKILL.md).
- [Angular agent tools](development.md#angular-agent-tools).

Choose the domain before reading or updating its documentation. Shared tooling remains in
this directory; business behavior belongs in its domain directory. Product descriptions
cover implemented behavior.

## Pending work

The [project backlog](todo/README.md) holds open tasks as tickets, one file per task, separately
from product documentation. Its `old/` folder keeps the earlier backlog as reference.

## Reference archive

[Deprecated reference material](archive/README.md), including Karma API/interface sources and
historical integration guides, is read only when a task needs it. It is excluded from routine
repository-wide documentation updates. Protocols, hardware and ERM correspondence remain in
[ERM resources](../discocan/docs/erm-resources/README.md).
