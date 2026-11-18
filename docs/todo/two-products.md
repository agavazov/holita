# Two products on a shared architecture

Owner direction, 2026-11-18. The repository keeps Discocan and Holita together while the shared
architecture is proven on both; a split is a later owner decision. The priorities are one visual
system for every operator screen, then one shared architecture. The goal now is a working
architecture with a thin Holita slice, not a port of the old platform.

## Decisions

- Top-level `discocan/`, `holita/` and `osnova/` in one npm/Nx workspace
  ([boundaries](../../AGENTS.md#products-and-boundaries)).
- `osnova/` is extracted from Discocan, never copied. Products use it only through `@osnova/*`
  package names, so that it can become its own repository later without changing product code.
- Each product runs its own Core instance, databases, gateway and ports. Holita uses ports from
  12000 and `holita_*` databases on the same PostgreSQL server, with its own database role.
- Sign-in stays the opaque Core session for now. Subgraphs verify it through one `@osnova/auth`
  implementation, which is the seam that OAuth/OpenID Connect replaces later.
- Holita has an operator graph and a separate public storefront graph
  ([Holita rules](../../holita/AGENTS.md)).
- Listings are shared presentational patterns with override points, not a generic CRUD framework.

## Steps

2. **Osnova backend.** Without behaviour change for Discocan:
   - Core moves to `osnova/apps/core`; each product runs it with its own configuration.
   - `@osnova/auth`: one NestJS session guard replacing the copies in Fleet and ERM Server; the
     token prefix stops carrying the product name (users sign in again once).
   - Core gains platform accounts beside tenant accounts (Holita: staff and sales agents) through
     an additive migration.
   - The shared sign-in page moves to `@osnova/ui`.
   - The Router base (binary install, configuration, Rhai hook) moves to Osnova; each product
     keeps a small gateway with its subgraph list.
   - Tooling becomes product-aware: GraphQL contracts, database setup, `kill`, the smoke fixture and
     `dev:discocan` / `dev:holita`.
3. **Holita operator slice.** Core instance and seeds (one staff account, one merchant with two
   shops); a `holita/apps/commerce` subgraph with products (name, price, status) and customers;
   the operator gateway; Backoffice (merchants and shops: list, create, suspend), Admin (shop
   selection, products list and editor, customers list) and Sales (the merchant list read-only for
   a sales agent). All three use the shared shell, sign-in and listings.
4. **Holita storefront.** A second, public schema on the commerce subgraph and its own Router;
   the shop resolved from the request; per-shop shopper registration and sign-in with a
   shop-scoped token issued by commerce, not Core; `holita/apps/storefront` with the product list,
   a product page, registration, sign-in and the shopper's account page.

## Open items

- Before the next ERM deploy, repoint the `discocan-erm-*` user units to `discocan/apps/erm-server`
  and the inactive `holita-erm-relay` unit to `discocan/tools/erm-relay/relay.mts`. It restarts the
  ERM gateway, so the owner picks the moment.
- Take a database dump before step 2 changes Core.
- The 60-case test budget is shared by both products (47 used); Holita's isolation and contract
  tests need room, so a per-product budget needs the owner.
- `npm run format:check` fails on 14 tracked files that predate the move.
- Later: OpenID Connect sign-in, cart/checkout/orders, the storefront rendering engine, per-product
  CI and `osnova/` as its own repository.
