# backoffice

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone staff application for stores, merchants and system operations (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice`).

## Stack and runtime

PHP ^8.5, Laravel ^13.13, Blade and shared assets, Redis sessions; business database-free (`/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/config/database.php`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`). Queue/scheduler not found in skim.

## Data it owns

No business migrations found; browser session state only; API owns officer and business records (`/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Services/Api`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`).

## Interfaces

38 literal route declarations including health and nested controller routes; CRUD, impersonation and tools under `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/routes/web.php`. Local browser session/CSRF; API validates opaque officer bearer (`/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Services/Auth`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/backoffice.php`). Jobs/events not found in skim.

## Screens

Navigation: Dashboard → Stores (stores, merchants) → System (officers, email) → Tools → profile; 7 sidebar anchors (`/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/resources/views/backoffice/layouts/partials/navbar.blade.php`).

- Dashboard: overview.
- Stores: inspect/update/delete stores and enter merchant Admin by impersonation.
- Merchants: inspect, approve/manage merchant accounts.
- Officers: administer staff users.
- Emails and demos: inspect/manage queued messages and demo data.
- Tools: cache operations and MCP diagnostics; profile: account settings.
  Blade plus shared Bootstrap/JS; routes and views: `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/routes/web.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/resources/views/backoffice`, `/workspace/projects/red.bg/workspace-ecommerce/services/assets/package.json`.

## External integrations

MCP diagnostics through service client; upload operations via API (`/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Services/Mcp/McpDiagnosticClient.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Services/Api/ApiUploadManager.php`).

## Dependencies on other services

Auth PKCE flow, API officer bearer, Assets and MCP internal diagnostics (`/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Auth`, `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Services/Api`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`).

## Business rules worth keeping

Store deletion invokes API purge rather than simple CRUD; impersonation is API-authorized PKCE (`/workspace/projects/red.bg/workspace-ecommerce/docs/store-lifecycle.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoreImpersonationController.php`).

## Size

193 tracked files; included 183 excluded {'lockfiles': 1, 'images/assets': 1, 'restricted': 8} tests 12 migrations 0 commits 68; PHP: 83 files/7178 lines, Blade: 72 files/4407 lines, Other: 17 files/630 lines, Markdown: 4 files/249 lines, YAML: 1 files/209 lines, JSON: 4 files/95 lines, JavaScript: 1 files/89 lines, XML: 1 files/33 lines. Test-directory file counts (including fixtures/helpers): {'tests/CreatesApplication.php': 1, 'tests/Feature': 6, 'tests/Pest.php': 1, 'tests/TestCase.php': 1, 'tests/fixtures': 1, 'tests/interop': 2}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/backoffice` (`git ls-files`). Reimplementation: **M** — moderate staff UI and identity/impersonation boundaries.
