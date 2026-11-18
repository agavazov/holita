# go

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active standalone Short-code redirect edge (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/services/go/README.md`).

## Stack and runtime

nginx (`/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/go/compose.yaml`). Cache, queue and scheduler not found.

## Data it owns

No database or migrations (`/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`).

## Interfaces

GET/HEAD paths redirect 301 to Website; health/readiness (`/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`). Exact route count not established.

## Screens

Not applicable.

## External integrations

None found (`/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`).

## Dependencies on other services

Website is redirect target (`/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`).

## Business rules worth keeping

Preserve path encoding and existing query parameters (`/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`).

## Size

18 tracked files; included 18 excluded {} tests 1 migrations 0 commits 18; Other: 10 files/198 lines, Markdown: 5 files/140 lines, Shell: 2 files/127 lines, YAML: 1 files/54 lines. Test-directory file counts (including fixtures/helpers): {'tests/contract.sh': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/go` (`git ls-files`). Reimplementation: **S** — small redirect contract.
