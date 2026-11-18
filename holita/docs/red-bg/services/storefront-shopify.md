# storefront-shopify

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Independent Shopify-compatible Liquid renderer, domain-selected by Router (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/README.md`). Deployment assignments not inspected.

## Stack and runtime

Node >=22, LiquidJS ^10.27, AJV and Tailwind ^4.3; nginx front; no owned DB found (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/theme-engine/package.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/compose.yaml`). Cache/queue/scheduler not found in skim.

## Data it owns

No migrations; Core/API owns installed themes, settings, templates, version snapshots and publication (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/README.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Models/Main/Storefront`). Local theme packages are source artifacts.

## Interfaces

Public rendering and health; authenticated private Theme API for catalog, schema, validation, preview and package operations; service token for Core API (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/README.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/theme-engine/src`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/contracts/adapter/v1`). Exact endpoint counts not established.

## Screens

Not applicable; renders shopper pages and editor previews.

## External integrations

Shopify reference/adapter and Liquid compatibility tooling (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/dev-tools/src/adapters`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/theme-engine/package.json`); theme files counted only.

## Dependencies on other services

Router selects engine; API supplies canonical storefront data and calls private Theme API (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/README.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/lua/storefront_router/engines.lua`).

## Business rules worth keeping

Published theme/version is store-owned; preview and publication are separated (`/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/admin.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify/contracts/adapter/v1`). Native is a mixed tree and selected unavailable engine returns 503 (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`).

## Size

6125 tracked files; included 440 excluded {'lockfiles': 2, 'images/assets': 147, 'theme files': 5536} tests 135 migrations 0 commits 184; JavaScript: 207 files/51458 lines, HTML: 120 files/45342 lines, JSON: 75 files/9458 lines, Markdown: 23 files/3021 lines, Other: 14 files/359 lines, YAML: 1 files/94 lines. Test-directory file counts (including fixtures/helpers): {'dev-tools/integration': 3, 'dev-tools/test': 36, 'theme-engine/test': 96}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/shopify` (`git ls-files`). Reimplementation: **XL** — rendering, compatibility, editor contracts and extensive theme packages.
