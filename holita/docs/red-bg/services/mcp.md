# mcp

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Standalone MCP server exposing merchant Admin operations to MCP clients (`/workspace/projects/red.bg/workspace-ecommerce/services/mcp/package.json`, `/workspace/projects/red.bg/workspace-ecommerce/docs/mcp-service.md`).

## Stack and runtime

TypeScript ^6, Express ^5.2, MCP SDK ^1.29, Node; DB/cache/queues not found (`/workspace/projects/red.bg/workspace-ecommerce/services/mcp/package.json`).

## Data it owns

No migrations or durable business tables found; API owns OAuth clients and sessions (`/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`).

## Interfaces

Public MCP POST and private Backoffice diagnostic route; OAuth bearer validation through API (`/workspace/projects/red.bg/workspace-ecommerce/services/mcp/src/server.ts`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`). Tool count not established; jobs/events not found.

## Screens

Not applicable.

## External integrations

MCP protocol clients and guarded image download (`/workspace/projects/red.bg/workspace-ecommerce/services/mcp/src`, `/workspace/projects/red.bg/workspace-ecommerce/services/mcp/tests/test-image-download.test.ts`). AI model provider not found.

## Dependencies on other services

Auth provides OAuth flows, API validates opaque bearer and executes Admin API requests; Backoffice calls private diagnostic route (`/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/mcp/src/integrations`).

## Business rules worth keeping

Public endpoint accepts API-owned opaque OAuth access, separate private diagnostic authentication; SSRF/egress guards (`/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/mcp/tests/egress-guard.test.ts`).

## Size

47 tracked files; included 46 excluded {'lockfiles': 1} tests 8 migrations 0 commits 35; TypeScript: 24 files/5551 lines, Other: 11 files/329 lines, YAML: 1 files/110 lines, Markdown: 5 files/108 lines, Shell: 2 files/78 lines, JSON: 2 files/52 lines, JavaScript: 1 files/18 lines. Test-directory file counts (including fixtures/helpers): {'tests/admin-issuer.test.ts': 1, 'tests/backend.conf.template': 1, 'tests/contract.sh': 1, 'tests/egress-connect-guard.test.ts': 1, 'tests/egress-guard.test.ts': 1, 'tests/jwt-dual-verify.test.ts': 1, 'tests/test-image-download.test.ts': 1, 'tests/test-image-feature-gate.test.ts': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/mcp` (`git ls-files`). Reimplementation: **M** — tool contracts, authorization and egress controls.
