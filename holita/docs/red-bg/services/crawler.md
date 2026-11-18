# crawler

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone crawler execution service for discovery, site analysis and catalog acquisition (`/workspace/projects/red.bg/workspace-sales/services/crawler/README.md`). Normalized discovery/site-analysis business results are owned by Sales (`/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`).

## Stack and runtime

Node >=24, TypeScript ^6, Express ^5, PostgreSQL/pg, Redis/BullMQ; separate API and specialized workers (`/workspace/projects/red.bg/workspace-sales/services/crawler/package.json`, `/workspace/projects/red.bg/workspace-sales/services/crawler/README.md`). Browserless performs browser acquisition; schedules/queues are worker-driven (`/workspace/projects/red.bg/workspace-sales/services/crawler/src`, `/workspace/projects/red.bg/workspace-sales/services/crawler/compose.yaml`).

## Data it owns

49 tracked SQL migrations (`/workspace/projects/red.bg/workspace-sales/services/crawler/migrations`). `crawler` schema contains diagnostic runs/events, discovery runs/targets/delivery outbox, site-analysis execution/delivery, catalogSync runs/items/resources/relationships/issues; published `crawlerRead` views expose bounded inspection (`/workspace/projects/red.bg/workspace-sales/services/crawler/migrations/038_create_discovery_delivery_outbox.sql`, `/workspace/projects/red.bg/workspace-sales/services/crawler/migrations/043_replace_catalog_with_catalog_sync.sql`, `/workspace/projects/red.bg/workspace-sales/services/crawler/README.md`). IDs and per-source/run relations require table-specific mapping; UUID use appears in migrations, universal ID type not established. Old create migrations may describe later-dropped tables; current schema is migration sequence, not their union (`/workspace/projects/red.bg/workspace-sales/services/crawler/migrations/042_remove_discovery_business_storage.sql`).

## Interfaces

Private authenticated HTTP commands for diagnostics, discovery, site analysis, catalog sync and media; BullMQ workers and delivery outbox (`/workspace/projects/red.bg/workspace-sales/services/crawler/src`, `/workspace/projects/red.bg/workspace-sales/services/crawler/README.md`). Endpoint counts not established. Sales reads bounded `crawlerRead` views and receives discovery/site-analysis deliveries (`/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`).

## Screens

No independent operator screens found; Sales provides UI.

## External integrations

Pazaruvaj, CloudCart, eMAG, NRA and ShopMania discovery; Shopify, WooCommerce, CloudCart and eMAG catalog acquisition (`/workspace/projects/red.bg/workspace-sales/services/crawler/README.md`). Browserless Chromium (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`).

## Dependencies on other services

Sales calls crawler private API and reads restricted views; crawler delivers normalized observations to Sales; Browserless handles acquisition (`/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`, `/workspace/projects/red.bg/workspace-sales/services/crawler/README.md`). Auth credential names/algorithm beyond private authentication not established.

## Business rules worth keeping

Discovery delivery uses payload-owning transactional outbox; Sales canonicalizes UUID and deduplicates by source/external ID with freshness protection (`/workspace/projects/red.bg/workspace-sales/docs/architecture/sales-crawler-data-contract.md`, `/workspace/projects/red.bg/workspace-sales/services/crawler/migrations/041_make_discovery_outbox_payload_owned.sql`). Runs are restart-safe, bounded and retain normalized evidence rather than raw response files (`/workspace/projects/red.bg/workspace-sales/services/crawler/README.md`).

## Size

239 tracked files; included 238 excluded {'lockfiles': 1} tests 82 migrations 49 commits 56; TypeScript: 148 files/41768 lines, SQL: 49 files/6251 lines, Markdown: 6 files/1272 lines, JSON: 15 files/658 lines, HTML: 10 files/386 lines, YAML: 1 files/352 lines, Other: 8 files/197 lines, XML: 1 files/15 lines. Test-directory file counts (including fixtures/helpers): {'tests/app.test.ts': 1, 'tests/browser-acquisition.test.ts': 1, 'tests/browserless-session.test.ts': 1, 'tests/catalog-sync-acquisition.test.ts': 1, 'tests/catalog-sync-cloudcart-runtime.test.ts': 1, 'tests/catalog-sync-database-scale.test.ts': 1, 'tests/catalog-sync-durable-scale.test.ts': 1, 'tests/catalog-sync-emag-adapter.test.ts': 1, 'tests/catalog-sync-execution-settings.test.ts': 1, 'tests/catalog-sync-http.test.ts': 1, 'tests/catalog-sync-normalization.test.ts': 1, 'tests/catalog-sync-operator-session.test.ts': 1, 'tests/catalog-sync-pacing.test.ts': 1, 'tests/catalog-sync-platform-adapters.test.ts': 1, 'tests/catalog-sync-read-contract.test.ts': 1, 'tests/catalog-sync-runtime-service.test.ts': 1, 'tests/catalog-sync-store.test.ts': 1, 'tests/catalog-sync-validation.test.ts': 1, 'tests/catalog-sync-viewer-contract.test.ts': 1, 'tests/catalog-sync-writer.test.ts': 1, 'tests/cloudcart-extractor.test.ts': 1, 'tests/concurrency.test.ts': 1, 'tests/crm-discovery-contract.test.ts': 1, 'tests/diagnostic-processor.test.ts': 1, 'tests/discovery-api-client.test.ts': 1, 'tests/discovery-cleanup.test.ts': 1, 'tests/discovery-delivery-migration.test.ts': 1, 'tests/discovery-delivery-service.test.ts': 1, 'tests/discovery-delivery-store.test.ts': 1, 'tests/discovery-delivery-transaction.test.ts': 1, 'tests/discovery-drain-processor.test.ts': 1, 'tests/discovery-read-contract.test.ts': 1, 'tests/discovery-target-store.test.ts': 1, 'tests/discovery-targets.test.ts': 1, 'tests/emag-extractor.test.ts': 1, 'tests/emag-normalized-adapter.test.ts': 1, 'tests/fixtures': 24, 'tests/media-download-http.test.ts': 1, 'tests/media-download.test.ts': 1, 'tests/nra-extractor.test.ts': 1, 'tests/operator-attention.test.ts': 1, 'tests/pazaruvaj-extractor.test.ts': 1, 'tests/queue.test.ts': 1, 'tests/runtime-store.test.ts': 1, 'tests/shopmania-acquisition.test.ts': 1, 'tests/shopmania-enumeration.test.ts': 1, 'tests/shopmania-extractor.test.ts': 1, 'tests/shopmania-target-acquisition.test.ts': 1, 'tests/site-analyzer-catalog-metrics.test.ts': 1, 'tests/site-analyzer-contract.test.ts': 1, 'tests/site-analyzer-delivery-service.test.ts': 1, 'tests/site-analyzer-delivery-store.test.ts': 1, 'tests/site-analyzer-execution-store.test.ts': 1, 'tests/site-analyzer-normalization.test.ts': 1, 'tests/site-analyzer-platform-enrichment.test.ts': 1, 'tests/site-analyzer-processor.test.ts': 1, 'tests/site-analyzer-read-contract.test.ts': 1, 'tests/site-analyzer-runtime-service.test.ts': 1, 'tests/site-analyzer-signals.test.ts': 1}. Source: `/workspace/projects/red.bg/workspace-sales/services/crawler` (`git ls-files`). Reimplementation: **XL** — many adapters, durable acquisition state and cross-service delivery semantics.
