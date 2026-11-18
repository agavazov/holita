# auth

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone browser authentication BFF; API owns durable identity and authorization (`/workspace/projects/red.bg/workspace-ecommerce/services/auth/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`).

## Stack and runtime

PHP ^8.5/Laravel ^13.13, Blade, Redis browser sessions, no PostgreSQL (`/workspace/projects/red.bg/workspace-ecommerce/services/auth/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/auth/config/database.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/auth/config/session.php`). Queue/scheduler not found.

## Data it owns

No business migrations or models; temporary browser state and CSRF session only (`/workspace/projects/red.bg/workspace-ecommerce/services/auth/app/Services/Auth`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`).

## Interfaces

18 literal route declarations plus dynamically registered browser form routes; merchant, shopper, officer, social and MCP OAuth flows, discovery/register/token and health (`/workspace/projects/red.bg/workspace-ecommerce/services/auth/routes/web.php`). Auth calls API for identities, PKCE exchange and OAuth; forms use session/CSRF (`/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`). Jobs/events not found.

## Screens

Login/signup/recovery for merchant and shopper, officer login, social handoff and MCP consent (`/workspace/projects/red.bg/workspace-ecommerce/services/auth/resources/views`, `/workspace/projects/red.bg/workspace-ecommerce/services/auth/routes/web.php`).

## External integrations

Social-provider browser redirects; provider credential and exchange ownership is API (`/workspace/projects/red.bg/workspace-ecommerce/services/auth/app/Http/Controllers/Auth/SocialController.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Auth`).

## Dependencies on other services

Admin, Backoffice and Storefront redirect to Auth; Auth calls API; MCP relies on OAuth endpoints (`/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/auth/app/Services/Api/AuthApiClient.php`).

## Business rules worth keeping

Single-use short-lived PKCE codes bound to client, redirect, audience and challenge; independent service cookies; impersonation uses API assertion (`/workspace/projects/red.bg/workspace-ecommerce/services/api/docs/auth-boundary.md`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`).

## Size

93 tracked files; included 87 excluded {'lockfiles': 1, 'restricted': 5} tests 5 migrations 0 commits 49; PHP: 48 files/5959 lines, Blade: 11 files/533 lines, Other: 17 files/485 lines, YAML: 1 files/214 lines, JSON: 5 files/185 lines, Markdown: 3 files/102 lines, XML: 1 files/36 lines, Shell: 1 files/15 lines. Test-directory file counts (including fixtures/helpers): {'tests/Feature': 4, 'tests/TestCase.php': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/auth` (`git ls-files`). Reimplementation: **M** — security-sensitive multi-actor browser flows.
