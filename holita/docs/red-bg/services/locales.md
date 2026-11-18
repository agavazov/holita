# locales

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Shared translation data mounted into Admin, Auth, Backoffice and Basic; this directory is not a Git repository (`/workspace/projects/red.bg/workspace-ecommerce/docs/translations.md`). The tracked source is root `locales/`, whereas `services/locales/` contains mount directories.

## Stack and runtime

JSON locale registry and translations, Laravel localization fallback (`/workspace/projects/red.bg/workspace-ecommerce/docs/translations.md`, `/workspace/projects/red.bg/workspace-ecommerce/locales/locales.json`). No independent runtime, database, queue or scheduler.

## Data it owns

Shared translation keys and pending English under `/workspace/projects/red.bg/workspace-ecommerce/locales/translates` and `/workspace/projects/red.bg/workspace-ecommerce/locales/pending`; API and Website own separate catalogs (`/workspace/projects/red.bg/workspace-ecommerce/docs/translations.md`). No migrations or tenant IDs.

## Interfaces

Filesystem mounts consumed by services; translation scanner under `/workspace/projects/red.bg/workspace-ecommerce/tools/translate`; no HTTP API found.

## Screens

Not applicable.

## External integrations

Not found.

## Dependencies on other services

Admin, Auth, Backoffice and Basic consume registry and catalogs (`/workspace/projects/red.bg/workspace-ecommerce/docs/translations.md`).

## Business rules worth keeping

Active translation precedes pending English; Website uses Bulgarian source phrases and independent registry (`/workspace/projects/red.bg/workspace-ecommerce/docs/translations.md`).

## Size

`services/locales` has no `.git` and no tracked files found under that path in parent Git; root `/workspace/projects/red.bg/workspace-ecommerce/locales` has 20 tracked `translates/*.json` locale files plus registry and pending files (`git -C /workspace/projects/red.bg/workspace-ecommerce ls-files locales`). Parent `locales/` has 29 tracked files: JSON 24 files/62,578 lines, Markdown 3/270, other 2/2. Tests not found. Reimplementation: **M** — shared translations and distinct service catalogs need migration.
