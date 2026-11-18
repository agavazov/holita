# uploads

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone Public file and image derivative edge (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/services/uploads/README.md`).

## Stack and runtime

nginx and PHP/GD (`/workspace/projects/red.bg/workspace-ecommerce/services/uploads/docs/contract.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/uploads/compose.yaml`). Cache, queue and scheduler not found.

## Data it owns

API owns metadata and writes; public file mount and generated image derivatives (`/workspace/projects/red.bg/workspace-ecommerce/services/uploads/docs/contract.md`).

## Interfaces

Public paths, health/readiness; /uploader rejected (`/workspace/projects/red.bg/workspace-ecommerce/services/uploads/docs/contract.md`). Exact route count not established.

## Screens

Not applicable.

## External integrations

JPEG/GIF/PNG/WebP/AVIF derivatives (`/workspace/projects/red.bg/workspace-ecommerce/services/uploads/docs/contract.md`).

## Dependencies on other services

API writes authorized uploads; Admin/Backoffice use API (`/workspace/projects/red.bg/workspace-ecommerce/services/uploads/docs/contract.md`).

## Business rules worth keeping

Restrict derivative resolution to its namespace (`/workspace/projects/red.bg/workspace-ecommerce/services/uploads/docs/contract.md`).

## Size

22 tracked files; included 22 excluded {} tests 1 migrations 0 commits 28; PHP: 2 files/403 lines, Other: 12 files/350 lines, YAML: 1 files/117 lines, Markdown: 5 files/109 lines, Shell: 2 files/35 lines. Test-directory file counts (including fixtures/helpers): {'tests/contract.sh': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/uploads` (`git ls-files`). Reimplementation: **S** — small edge with image and path isolation.
