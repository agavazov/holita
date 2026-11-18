# sales

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone internal sales and CRM application (`/workspace/projects/red.bg/workspace-sales/services/sales/composer.json`, `/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`). It owns sales business state, distinct from ecommerce API.

## Stack and runtime

PHP ^8.5, Laravel ^13.13, Blade, Vite/Tailwind/JS; PostgreSQL, Redis queues and optional cache; read-only crawler DB connection (`/workspace/projects/red.bg/workspace-sales/services/sales/composer.json`, `/workspace/projects/red.bg/workspace-sales/services/sales/package.json`, `/workspace/projects/red.bg/workspace-sales/services/sales/config/database.php`, `/workspace/projects/red.bg/workspace-sales/services/sales/config/queue.php`). Hourly mobile retention scheduler (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Console/Kernel.php`).

## Data it owns

93 migration files (`/workspace/projects/red.bg/workspace-sales/services/sales/database/migrations`); models use string UUIDs, including IDs for local records and references to Core (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Models`, `/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Sales/CoreReferenceRegistry.php`).

- `auth`: sales users and communication method assignments; `sales`: settings, filter presets, public links/visits and merchant/store references.
- `crm`: leads, contacts, notes, tasks/suggestions, calls, recordings/transcripts, SMS, offers/deliveries, online stores, discoveries and site analyses.
- `booking`: services, availability and bookings.
- `catalogSync`: ingestion, items/events and lead links.
- `ops`: communication methods, idempotency, mobile devices, pairings, commands, event batches and uploads.
  Sales references merchant/store IDs owned by Core; crawler execution data stays in Crawler, discovered CRM facts in Sales (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Models`, `/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`).

## Interfaces

202 literal web route declarations with nested controller groups and GET/POST match routes excluded by the counting pattern; 17 literal internal/mobile declarations (`/workspace/projects/red.bg/workspace-sales/services/sales/routes/web.php`, `/workspace/projects/red.bg/workspace-sales/services/sales/routes/internal.php`). Browser routes use Sales authentication; crawler deliveries use `AuthenticateCrawlerRequest`, mobile device routes use device credentials. Jobs cover offer email, call transcription, catalog ingestion and site analysis (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Jobs`); hourly mobile retention (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Console/Kernel.php`).

## Screens

Sidebar: dashboard → CRM (leads, calls, offer maker, bookings, SMS, online stores) → Crawling (catalog sync, discoveries, site analyzer) → merchants/stores → users → system/workers/browser sessions → tools → settings. 19 sidebar anchors (`/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales/layouts/partials/navbar.blade.php`).

- Dashboard: sales activity and queues.
- Leads/contacts: qualify, link records, schedule tasks and capture notes.
- Calls, call workspace and SMS: communicate and inspect recordings/history.
- Offer maker: prepare, render and deliver offers.
- Bookings/services: manage appointment slots and appointments.
- Online stores: inspect and associate prospect shops.
- Catalog sync: crawl, review and ingest source catalog to Core.
- Discoveries and site analyzer: find prospects and review analyzed sites.
- Merchants/stores: link, create, inspect and configure Core records.
- Users, workers, browser sessions, mobile simulator, telephony links, settings/profile: administer sales operations.
  Blade with Vite/Tailwind and JavaScript (`/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales`, `/workspace/projects/red.bg/workspace-sales/services/sales/routes/web.php`, `/workspace/projects/red.bg/workspace-sales/services/sales/package.json`).

## External integrations

Telephony API for calls/SMS, Browserless for browsing, mail for offers, crawler for discovery/catalog; transcription job exists, model/provider not established (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Telephony`, `/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Browserless`, `/workspace/projects/red.bg/workspace-sales/services/sales/app/Jobs/Crm`).

## Dependencies on other services

Core internal API uses Ed25519 service token; Crawler uses private authenticated commands plus read-only database views and sends signed/authorized results to Sales; Telephony uses service bearer and client ID (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Core/Ed25519ServiceToken.php`, `/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`, `/workspace/projects/red.bg/workspace-sales/services/telephony/api/README.md`).

## Business rules worth keeping

Lead states new, approvedForCall, called, interested, notInterested, customer, lost, tryLater; notInterested/customer/lost close lead (`/workspace/projects/red.bg/workspace-sales/services/sales/app/Enums/Sales/Crm/CrmLeadStatus.php`). Ingestion is checkpointed, bounded, retries independently and Core deduplicates by source identity (`/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`).

## Size

1042 tracked files; included 877 excluded {'lockfiles': 2, 'images/assets': 36, 'restricted': 127} tests 100 migrations 93 commits 103; PHP: 443 files/71543 lines, JSON: 27 files/54250 lines, Blade: 256 files/23899 lines, JavaScript: 94 files/17620 lines, SCSS: 21 files/2405 lines, Markdown: 11 files/2232 lines, YAML: 2 files/1381 lines, HTML: 1 files/1210 lines, Other: 16 files/1097 lines, CSS: 1 files/299 lines, Shell: 4 files/129 lines, XML: 1 files/34 lines. Test-directory file counts (including fixtures/helpers): {'docker/test': 2, 'tests/CreatesApplication.php': 1, 'tests/Feature': 50, 'tests/Pest.php': 1, 'tests/Support': 3, 'tests/TestCase.php': 1, 'tests/browser': 3, 'tests/js': 39}. Source: `/workspace/projects/red.bg/workspace-sales/services/sales` (`git ls-files`). Reimplementation: **XL** — large CRM, booking, telephony and catalog migration work.
