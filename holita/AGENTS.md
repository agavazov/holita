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
  asked.
- The old platform in `/workspace/projects/red.bg` is a reference, not a source to port. Read it
  only when the task names it.

## Look

- Use a shared listing as it is, then through its override points, then by composing a page from
  the smaller shared elements. When an override point is missing, add it to the pattern as its
  own task.

The pending steps are in the [backlog](../docs/todo/two-products.md).
