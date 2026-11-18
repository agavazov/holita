# api

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone business and identity backend, the dominant migration boundary; former Platform runtime is retired (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/docs/phase-3-platform-retirement.md`). Source contains 565 commits; production usage was not inspected.

## Stack and runtime

PHP ^8.5, Laravel ^13.13 and PostgreSQL `pgsql-main`/`pgsql-data`; Redis cache and queue available, queue default sync; local disks and API-owned uploads (`/workspace/projects/red.bg/workspace-ecommerce/services/api/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/config/database.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/config/cache.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/config/queue.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/config/filesystems.php`). Scheduler has 18 commands (`/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/console.php`).

## Data it owns

110 migration files: 88 main, 22 data (`/workspace/projects/red.bg/workspace-ecommerce/services/api/database/migrations`). Most application IDs are database-generated UUIDs; integer exceptions exist (`/workspace/projects/red.bg/workspace-ecommerce/docs/database-ids.md`). Store-owned records use store ID or parent relation; authorization resolves membership server-side (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Support/Tenancy/StoreContext.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Stores/StoreCreationService.php`).

- `auth`: merchants, officers, social accounts, OAuth clients and password resets; `tenant`: stores, domains, merchant-store membership, locales, plans, features and subscriptions.
- `catalog`: products, variants, options, collections/rules, brands/categories, tags/badges, digital files and price history.
- `commerce`: carts/items, orders/items/addresses, stock reservations, draft orders, payments/refunds, shipments/labels/tracking, shipping rates/zones, VAT/exchange rates, invoices/lines, discounts, gift cards, returns, reviews and notifications.
- `customer`: customer identities/addresses, custom fields, newsletter, requests, consent and data-subject requests.
- `content`, `storefront`, `media`: pages/blog/content values; themes/templates/assets/versions, settings/navigation/feeds/redirects; uploads and directories.
- `analytics`, `events`, `webhooks`, `imports`, `catalogSync`, `integrations`, `marketing`, `marketplace`: events/rollups, outbox/deliveries, import records/mappings, connector credentials and sync state. `ops`/`sandbox`: email queue/audit and demos. Source for groups: `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Models` and `/workspace/projects/red.bg/workspace-ecommerce/services/api/database/migrations`; these are model-backed tables, not a claim of exhaustive live schema.

## Interfaces

`/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/admin.php`: 221 declarations including 22 resource macros; catalog 22, content 10, storefront 14, marketing 25, settings 27, customers 16, sales 21, documents 8, webhooks 9. Merchant bearer and store context. `/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/backoffice.php`: 29 (system 14, management 15), opaque officer bearer. `/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/storefront.php`: 56 including one resource macro (customer 15, cart 4, checkout 5), storefront service authentication and customer session where required. `/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/auth.php`: 46 including one resource macro; public throttled auth plus authenticated session/PKCE/OAuth. `/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/internal.php`: 12, internal service authentication for merchant/store and catalog ingestion. Additional payment/ERP callbacks and public feed routes: `/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api.php`.

Scheduler drains email, processes imports, relays outbox and webhooks, reconciles payments/COD, polls courier tracking, syncs marketplace, generates feeds, expires reservations/drafts, refreshes FX and rolls up analytics (`/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/console.php`). `OrderPaid` and outbox consumers cover invoice, search, notifications, digital delivery and marketing (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Events`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Events`).

## Screens

Not applicable; API provides JSON/OpenAPI.

## External integrations

Payment drivers: Stripe, PayPal, Revolut, ePay, Borica, myPOS and cash on delivery (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Payments`). Econt, Speedy, DPD and Box Now courier drivers (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Shipping`). Shopify, WooCommerce and Magento catalog connectors (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Integrations`); marketplaces Amazon, eBay, eMAG, Etsy and Kaufland and CRM/marketing connectors (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Marketplace`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Marketing`). mPDF invoices and NRA audit logic (`/workspace/projects/red.bg/workspace-ecommerce/services/api/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Commerce/Nra`). Mail queue sender (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Notifications/EmailQueueDrainer.php`). Presence in code does not establish configured providers.

## Dependencies on other services

Admin, Backoffice, Auth, Basic and MCP consume API contracts; Sales uses internal service-signed Core API; theme engines consume Storefront API and API calls their protected Theme APIs (`/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/internal.php`, `/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Core`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`). Router sync reads main DB (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/sync/src/query.mjs`).

## Business rules worth keeping

Approved merchant required; provision store, membership, theme, domain, default pages and navigation transactionally (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Stores/StoreCreationService.php`). Order statuses placed/confirmed/processing/shipped/cancelled/completed; stock held except cancelled; cancellation returns stock once (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Enums/Commerce/OrderStatus.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php`). Prices are VAT-inclusive and VAT extracted; invoice preserves order tax event/rate (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php`). Store capacity comes from plan entitlement; an expired subscription falls back to the free plan, while merchants never assigned a plan keep legacy limits (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Billing/PlanEntitlementService.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Enums/Merchant/PlanFeatureKey.php`). Theme publish snapshots and rollback (`/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/admin.php`). Store purge coordinates DB and filesystem (`/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeStorePurgeService.php`).

## Size

1610 tracked files; included 1603 excluded {'restricted': 6, 'lockfiles': 1} tests 321 migrations 110 commits 565; PHP: 1365 files/154145 lines, JSON: 156 files/37279 lines, Markdown: 58 files/9177 lines, Other: 20 files/8351 lines, YAML: 1 files/393 lines, XML: 3 files/62 lines. Test-directory file counts (including fixtures/helpers): {'tests/Database': 166, 'tests/DatabaseTestCase.php': 1, 'tests/E2E': 71, 'tests/TestCase.php': 1, 'tests/Unit': 81, 'tests/bootstrap.php': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/api` (`git ls-files`). Reimplementation: **XL** — many cross-domain tables, integrations, state machines and migration boundaries.
