# website

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Standalone public marketing website, not an operator app (`/workspace/projects/red.bg/workspace-ecommerce/services.tsv`, `/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/composer.json`).

## Stack and runtime

PHP ^8.5, Laravel ^13.20, Statamic ^6.25 flat-file CMS, Antlers/HTML and Vite assets (`/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/resources`). Database/cache/queue deployment choices not established.

## Data it owns

Localized file-based pages, globals and navigation (`/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/content`); no tracked SQL migrations found. Store tenancy not applicable.

## Interfaces

Public localized pages and CMS; translation sync commands (`/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/routes`, `/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/app/Console/Commands`). Route counts not established.

## Screens

English content files identify home, platform, product, pricing, about/company, contacts, news, legal, development, AI migration and go (12 files); page-specific subviews not separately counted (`/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/content/collections/pages/en`). Statamic Antlers/HTML; content editing via Statamic (`/workspace/projects/red.bg/workspace-ecommerce/services/website/laravel/composer.json`).

## External integrations

Admin signup entry and short-link destination (`/workspace/projects/red.bg/workspace-ecommerce/docs/platform-decomposition.md`, `/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`). Other provider usage not found in skim.

## Dependencies on other services

Go redirects to Website; Website starts merchant flow through Admin (`/workspace/projects/red.bg/workspace-ecommerce/services/go/docs/contract.md`, `/workspace/projects/red.bg/workspace-ecommerce/docs/platform-decomposition.md`).

## Business rules worth keeping

Website has a separate translation catalog with Bulgarian source keys, unlike shared operator catalog (`/workspace/projects/red.bg/workspace-ecommerce/docs/translations.md`).

## Size

1549 tracked files; included 957 excluded {'lockfiles': 2, 'images/assets': 551, 'restricted': 39} tests 1 migrations 0 commits 84; HTML: 75 files/87559 lines, Markdown: 658 files/42966 lines, CSS: 4 files/26601 lines, JSON: 40 files/15230 lines, PHP: 47 files/4906 lines, JavaScript: 5 files/4568 lines, YAML: 52 files/2220 lines, Other: 73 files/665 lines, Shell: 2 files/59 lines, Blade: 1 files/18 lines. Test-directory file counts (including fixtures/helpers): {'tests/contract.sh': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/website` (`git ls-files`). Reimplementation: **L** — substantial localized flat-file content and templates; functional scope needs confirmation.
