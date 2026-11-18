# storefront-native

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Independent Native component renderer; documented internal pilot, with retained Shopify-era code and themes (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`). Registered in router, live assignments not inspected.

## Stack and runtime

Node >=22, LiquidJS ^10.27, AJV and Tailwind ^4.3; nginx front; no owned DB found (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/theme-engine/package.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/compose.yaml`). Cache/queue/scheduler not found in skim.

## Data it owns

No migrations; Core/API owns installed themes, settings, templates, version snapshots and publication (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/api/app/Models/Main/Storefront`). Local theme packages are source artifacts.

## Interfaces

Public rendering and health; authenticated private Theme API for catalog, schema, validation, preview and package operations; service token for Core API (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/theme-engine/src`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/contracts/adapter/v1`). Exact endpoint counts not established.

## Screens

Not applicable; renders shopper pages and editor previews.

## External integrations

Shopify reference/adapter and Liquid compatibility tooling (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/dev-tools/src/adapters`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/theme-engine/package.json`); theme files counted only.

## Dependencies on other services

Router selects engine; API supplies canonical storefront data and calls private Theme API (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/router/lua/storefront_router/engines.lua`).

## Business rules worth keeping

Published theme/version is store-owned; preview and publication are separated (`/workspace/projects/red.bg/workspace-ecommerce/services/api/routes/api/v1/admin.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/contracts/adapter/v1`). Native is a mixed tree and selected unavailable engine returns 503 (`/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native/README.md`).

## Size

6344 tracked files; included 572 excluded {'lockfiles': 2, 'images/assets': 162, 'theme files': 5608} tests 150 migrations 0 commits 183; JavaScript: 282 files/69866 lines, HTML: 120 files/45342 lines, JSON: 126 files/13098 lines, Markdown: 29 files/4298 lines, Other: 14 files/346 lines, YAML: 1 files/89 lines. Test-directory file counts (including fixtures/helpers): {'dev-tools/integration': 3, 'dev-tools/test': 31, 'theme-engine/test': 116}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/storefront/native` (`git ls-files`). Reimplementation: **XL** — rendering, compatibility, editor contracts and extensive theme packages.
