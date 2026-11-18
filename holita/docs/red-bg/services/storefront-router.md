# storefront-router

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active domain-to-engine ingress; registered for Basic, Shopify and Native (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/lua/storefront_router/engines.lua`). `/workspace/projects/red.bg/workspace-ecommerce/docs/routes.md` says all traffic goes to Basic and Shopify is dark; implementation contains all three mappings, while actual domain assignments were not inspected.

## Stack and runtime

OpenResty/nginx Lua plus Node >=24 sync, PostgreSQL reader and Redis registry (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/sync/package.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/docker/openresty`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/sync/src`).

## Data it owns

No migrations; reads domain routing from API-owned PostgreSQL and writes a Redis registry (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/sync/src/query.mjs`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/sync/src/registry.mjs`).

## Interfaces

HTTP host routing and health, sync process; Lua dispatch chooses upstream from registry (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/lua/storefront_router`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/docker/openresty/default.conf`). Explicit route count not applicable.

## Screens

Not applicable.

## External integrations

Managed domain routing; TLS termination details not found in router source skim (`/workspace/projects/red.bg/workspace-ecommerce/docs/storefront-router.md`).

## Dependencies on other services

Main → Basic, shopify → Shopify, native → Native; registry sync reads API PostgreSQL (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/lua/storefront_router/engines.lua`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/sync/src/query.mjs`).

## Business rules worth keeping

Engine is domain-selected; unavailable selected engine should not silently route to another renderer (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/lua/storefront_router/routing.lua`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`).

## Size

30 tracked files; included 28 excluded {'restricted': 1, 'lockfiles': 1} tests 5 migrations 0 commits 7; Shell: 2 files/663 lines, JavaScript: 10 files/573 lines, Markdown: 3 files/311 lines, Lua: 3 files/258 lines, Other: 8 files/223 lines, YAML: 1 files/133 lines, JSON: 1 files/17 lines. Test-directory file counts (including fixtures/helpers): {'sync/test': 2, 'tests/fixtures': 1, 'tests/smoke.sh': 1, 'tests/sync-smoke.sh': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router` (`git ls-files`). Reimplementation: **M** — small codebase but domain isolation and safe failure are operationally important.
