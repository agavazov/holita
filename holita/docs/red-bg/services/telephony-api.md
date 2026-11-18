# telephony-api

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active independent provider-neutral V2 call/SMS control plane; V1 runtime is retired (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/migrations/013_remove_legacy_storage.sql`).

## Stack and runtime

Node >=24, TypeScript ^7, pg and ws; PostgreSQL, central Asterisk and browser SIP, local/remote recording storage (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/package.json`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/docs/architecture.md`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`). Redis/queue scheduler not found in skim.

## Data it owns

14 SQL migrations (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/migrations`). `telephony_core`: connectors/lines/routes, calls/SMS, commands/idempotency, domain events/audit, recordings/assets, browser presences/leases and change-feed cursors (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/migrations/004_v2_foundation.sql`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/migrations/005_v2_http_security.sql`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/migrations/011_browser_endpoint_leases.sql`). UUID IDs used for aggregates; source migrations contain legacy tables subsequently removed; no merchant/store tenancy found, route grants scope access.

## Interfaces

`/v2` route discovery, calls/control, SMS, recordings, browser presence/signaling, change feed/snapshot, operations and `/v2/openapi.json`; browser SDK and operational UI (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/docs/v2-api-contract.md`). Exact route count not established. Service bearer + client ID for Sales, independent operator bearer/cookie, scoped browser credentials; change feed supports Sales projection (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`).

## Screens

Independent Control Center for system, routes, calls, recordings and events, plus route diagnostics (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/dashboard`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`).

## External integrations

Asterisk central adapter and gateway over SIP/AMI, WebRTC browser signaling, recordings (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/asterisk`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/docs/architecture.md`).

## Dependencies on other services

Sales submits intents, receives snapshots/change feed and owns agent-to-route assignments; Gateway executes telephony (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`).

## Business rules worth keeping

Idempotent intent, ordered lifecycle, independent inbound/outbound grants, bounded browser presence and renewable endpoint lease; central recording ownership (`/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/migrations/014_browser_route_permissions.sql`).

## Size

145 tracked files; included 133 excluded {'lockfiles': 1, 'restricted': 11} tests 24 migrations 14 commits 59; TypeScript: 26 files/9272 lines, JavaScript: 36 files/5083 lines, Markdown: 13 files/2025 lines, SQL: 14 files/1719 lines, Shell: 16 files/1517 lines, Other: 17 files/452 lines, YAML: 1 files/329 lines, HTML: 8 files/255 lines, JSON: 2 files/52 lines. Test-directory file counts (including fixtures/helpers): {'tests/ari.test.mjs': 1, 'tests/contract.sh': 1, 'tests/dashboard-assets.test.mjs': 1, 'tests/dashboard-session.test.mjs': 1, 'tests/gateway-ami.test.mjs': 1, 'tests/gateway-client.test.mjs': 1, 'tests/resolve-single-ipv4.test.sh': 1, 'tests/sdk-v2.test.mjs': 1, 'tests/v2-asterisk-gateway-adapter.test.mjs': 1, 'tests/v2-browser-signaling.test.mjs': 1, 'tests/v2-connector-port.test.mjs': 1, 'tests/v2-domain.test.mjs': 1, 'tests/v2-foundation-database.mjs': 1, 'tests/v2-foundation-database.sh': 1, 'tests/v2-http-database.mjs': 1, 'tests/v2-http-database.sh': 1, 'tests/v2-http.test.mjs': 1, 'tests/v2-maintenance.test.mjs': 1, 'tests/v2-observability.test.mjs': 1, 'tests/v2-operations-performance-database.mjs': 1, 'tests/v2-operations-performance-database.sh': 1, 'tests/v2-rate-limiter.test.mjs': 1, 'tests/v2-recording-store.test.mjs': 1, 'tests/webrtc.test.mjs': 1}. Source: `/workspace/projects/red.bg/workspace-sales/services/telephony/api` (`git ls-files`). Reimplementation: **L** — security, synchronized call lifecycle and operational signaling.
