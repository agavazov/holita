# storefront-basic

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Laravel shopper-facing renderer for `main`; direct origin is also rollback/diagnostic boundary (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/docs/storefront-basic.md`). Route source contains cart, checkout and customer actions, so older auth documentation describing it as read-only is stale (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php`). Actual production traffic not verified.

## Stack and runtime

PHP ^8.5/Laravel ^13.13, Blade/Bootstrap, Redis, API-backed; no business DB (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/config`).

## Data it owns

No business migrations; session/cache only; API owns catalog, commerce and identity (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront`, `/workspace/projects/red.bg/workspace-ecommerce/docs/database-layout.md`).

## Interfaces

54 literal routes: 19 account, 5 cart, 3 checkout plus catalog, content, blog, contact, search, auth and health (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php`). Browser session and customer PKCE; calls API with Ed25519 service token (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/Ed25519ServiceToken.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/CustomerAuthController.php`). Jobs/scheduler not found.

## Screens

Shopper pages: home, products/listings, search, blog/pages, cart, checkout, confirmation and account (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php`).

## External integrations

Tracking/consent and checkout payment handoff (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/TrackingTags.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/CheckoutPaymentHandoff.php`). Provider selection is API-owned.

## Dependencies on other services

Router forwards `main`; Basic calls API and Auth; Assets provides build, Uploads public media (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/lua/storefront_router/engines.lua`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/StorefrontApiClient.php`).

## Business rules worth keeping

Visitor consent controls tracking, locale and store context resolution, checkout handoff and customer sessions (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/VisitorConsent.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Middleware/ResolveStorefrontContext.php`).

## Size

200 tracked files; included 192 excluded {'lockfiles': 1, 'restricted': 7} tests 11 migrations 0 commits 56; PHP: 75 files/11076 lines, Blade: 91 files/6700 lines, JSON: 5 files/1148 lines, Markdown: 6 files/653 lines, Other: 12 files/297 lines, Shell: 1 files/271 lines, YAML: 1 files/186 lines, JavaScript: 1 files/90 lines. Test-directory file counts (including fixtures/helpers): {'tests/bootstrap-cache.php': 1, 'tests/checkout-payment.php': 1, 'tests/cookie-consent-banner.js': 1, 'tests/cookie-consent.php': 1, 'tests/ed25519-service-token.php': 1, 'tests/homepage-seo.php': 1, 'tests/security-headers.php': 1, 'tests/smoke.sh': 1, 'tests/theme-rendering.php': 1, 'tests/theme-settings.php': 1, 'tests/tracking-consent.php': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/basic` (`git ls-files`). Reimplementation: **L** — shopper flows and SEO/consent are broader than a static renderer.
