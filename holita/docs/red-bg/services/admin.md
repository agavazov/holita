# admin

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Active merchant operator application; API-backed, no business database ownership (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/docs/platform-decomposition.md`).

## Stack and runtime

PHP ^8.5, Laravel ^13.13, server-rendered Blade, Bootstrap/JS assets; Redis session/cache, no business DB (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/composer.json`, `/workspace/projects/red.bg/workspace-ecommerce/services/admin/config/database.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/assets/package.json`). Queue/scheduler not found in skim.

## Data it owns

No business tables or migrations found; bearer and browser state live in its own server-side session (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/app/Services/Auth`, `/workspace/projects/red.bg/workspace-ecommerce/services/admin/config/session.php`).

## Interfaces

303 literal route declarations: catalog 62, settings 59, customers 41, design 30, sales 21, blog 18, marketing 17, invoices/documents 13, plus auth, uploads and dashboard (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/routes/admin.php`). Browser routes use local session/CSRF; business requests use merchant opaque bearer via API clients (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/app/Services/Api`, `/workspace/projects/red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Auth`). No jobs found in `/workspace/projects/red.bg/workspace-ecommerce/services/admin/app`.

## Screens

Navigation: dashboard → orders → products → customers → sales channels → marketing → blog → design/files → analytics → integrations → settings (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/resources/views/admin/layouts/partials/navbar.blade.php`). 89 sidebar anchor elements, 43 lead to coming-soon placeholders; counts are links, not unique screens. Blade templates with shared Bootstrap/JS (`/workspace/projects/red.bg/workspace-ecommerce/services/assets/package.json`).

- Dashboard, stores, profile and notifications: view shop status, switch/manage stores and account.
- Orders, invoices, returns and refunds: inspect and operate commerce records.
- Products, inventory, collections, categories, brands, options, characteristics, badges and imports: edit catalog and stock.
- Customers, inquiries, custom fields and newsletter: manage customer records and requests.
- Discounts, gift cards, SEO, feeds, feed channels and reviews: operate marketing.
- Blog articles/tags, pages, navigation, logo, themes/editor, Basic settings and shared files: manage presentation/content.
- Sales analytics: inspect rollups; settings manage general, tracking, shipping, payments, domains, locales, ERP, marketplace, marketing and webhooks.
  Sources: `/workspace/projects/red.bg/workspace-ecommerce/services/admin/resources/views/admin`, `/workspace/projects/red.bg/workspace-ecommerce/services/admin/routes/admin.php`; coming-soon links must not be counted as implemented screens.

## External integrations

Integration settings screens configure API-owned providers; uploader sends through API (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings`, `/workspace/projects/red.bg/workspace-ecommerce/services/admin/app/Services/Api`). Direct provider credentials not found.

## Dependencies on other services

Auth PKCE start/callback, API bearer, Assets static build and Uploads public files (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Auth/AuthSessionController.php`, `/workspace/projects/red.bg/workspace-ecommerce/services/admin/app/Services/Api`, `/workspace/projects/red.bg/workspace-ecommerce/docs/auth.md`).

## Business rules worth keeping

Unapproved merchants see waiting list; ownership/validation are API decisions (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/routes/admin.php`, `/workspace/projects/red.bg/workspace-ecommerce/docs/store-lifecycle.md`). Navigation explicitly marks many entries coming soon (`/workspace/projects/red.bg/workspace-ecommerce/services/admin/resources/views/admin/layouts/partials/navbar.blade.php`).

## Size

462 tracked files; included 456 excluded {'lockfiles': 1, 'restricted': 5} tests 20 migrations 0 commits 153; Blade: 257 files/29412 lines, PHP: 167 files/23303 lines, JavaScript: 1 files/645 lines, Markdown: 7 files/534 lines, Other: 16 files/447 lines, YAML: 1 files/208 lines, JSON: 5 files/94 lines, XML: 1 files/27 lines, Shell: 1 files/15 lines. Test-directory file counts (including fixtures/helpers): {'tests/Feature': 17, 'tests/Fixtures': 2, 'tests/TestCase.php': 1}. Source: `/workspace/projects/red.bg/workspace-ecommerce/services/admin` (`git ls-files`). Reimplementation: **XL** — large route and screen surface despite thin business backend.
