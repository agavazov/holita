# Holita contributor instructions

Apply the [workspace guide](../AGENTS.md) first: its delivery policy and product boundaries come
first. Holita is a SaaS platform for online shops, built on the architecture it shares with
Discocan. Its package scope is `@holita/*` and its Nx projects are named `holita-<application>`.

## Shape (owner decisions, 2026-11-18)

- Operator applications: `apps/admin` (a merchant manages their shops), `apps/backoffice`
  (platform staff manage merchants and shops) and `apps/sales` (the internal sales platform).
  `apps/storefront` is the basic shop front, without themes, that exercises the storefront API.
- Two GraphQL graphs, each behind its own Router: the operator graph for Admin, Backoffice and
  Sales, and the public storefront graph. A service that serves both keeps two schemas over the
  same services and repositories. An operator field never appears in the storefront schema.
- Operators (platform staff, merchants and sales agents) are Core accounts and use the one shared
  sign-in. Shoppers are customers of a single shop: they register in each shop, their e-mail is
  unique within that shop and they are not Core accounts.
- A Branch is an online shop. The storefront resolves it from the request; an operator request
  takes it from the verified session and the selected Branch.
- Start basic: a few fields per entity, enough to run and test every layer. Add depth only when
  asked. Branch discovery and a basic storefront catalogue are implemented; cart, checkout and orders are not.
- The old platform in `/workspace/projects/red.bg` is a reference, not a source to port; its
  [inventory](docs/red-bg/README.md) is a reference map. Read the platform
  only when the task names it.

## Look

- Use a shared listing as it is, then through its override points, then by composing a page from
  the smaller shared elements. When an override point is missing, add it to the pattern as its
  own task.

The pending steps are in the [backlog](../docs/todo/two-products.md).

## Applications and local development

- `apps/admin` serves merchant operators on 12000; `apps/backoffice` serves platform staff on
  12001; `apps/sales` serves sales agents on 12002.
- `apps/storefront` serves shoppers on 12020. The operator Router uses 12010 (health 12016),
  and the storefront Router uses 12030 (health 12036). Shared Core uses 12011 and Commerce 12013.
- A shop URL is `/s/<branchId>`; the storefront graph uses the `x-branch-id` header and only
  exposes its public catalogue and shop-scoped shopper accounts.
- `npm run db:setup:holita` and `npm run db:test:setup:holita` provision only Holita roles and
  databases; `npm run db:migrate:holita` and `npm run db:seed:holita` prepare its development data.
  `npm run dev:holita` starts the product and `npm run kill` stops both products' development apps.
- Instance settings live in ignored `holita/config/core.env` and `holita/config/commerce.env`;
  insert-only account seeds read ignored `holita/config/seed-accounts.env`. Never commit or print
  their values. `holita/tools/runtime-config.mts` creates them once when none exist.
