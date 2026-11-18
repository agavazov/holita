# assets

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone Static assets and UI build service (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/services/assets/README.md`).

## Stack and runtime

nginx, Vite ^8, Tailwind ^4, Sass, Bootstrap and JS (`/workspace/projects/red.bg/workspace-ecommerce/services/assets/docs/contract.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/assets/compose.yaml`). Cache, queue and scheduler not found.

## Data it owns

No database or migrations; source/build artifacts (`/workspace/projects/red.bg/workspace-ecommerce/services/assets/docs/contract.md`).

## Interfaces

Static asset trees and health; no business API (`/workspace/projects/red.bg/workspace-ecommerce/services/assets/docs/contract.md`). Exact route count not established.

## Screens

Not applicable.

## External integrations

Bootstrap, jQuery, ECharts and UI libraries (`/workspace/projects/red.bg/workspace-ecommerce/services/assets/docs/contract.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/assets/package.json`).

## Dependencies on other services

Admin, Auth, Backoffice and Basic load assets (`/workspace/projects/red.bg/workspace-ecommerce/services/assets/docs/contract.md`).

## Business rules worth keeping

Versioned manifests/build targets per consumer (`/workspace/projects/red.bg/workspace-ecommerce/services/assets/docs/contract.md`).

## Size

502 tracked files; included 177 excluded {'lockfiles': 1, 'images/assets': 324} tests 2 migrations 0 commits 73; SCSS: 124 files/17701 lines, JavaScript: 32 files/10774 lines, CSS: 3 files/429 lines, Other: 10 files/324 lines, Markdown: 5 files/130 lines, YAML: 1 files/61 lines, JSON: 1 files/37 lines, Shell: 1 files/31 lines. Test-directory file counts (including fixtures/helpers): {'resources/assets': 1, 'tests/contract.sh': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/assets` (`git ls-files`). Reimplementation: **M** — large frontend asset surface; replacement may eliminate much of it.
