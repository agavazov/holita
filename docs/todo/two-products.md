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

1. **Discocan shared sign-in.** Adopt the shared sign-in page in the Discocan admin, preserving
   its demo Tenant/Branch selection and existing appearance.
2. **Tooling placement.** Move the root `tools/` scripts (`kill.mts`, `holita-database.mts`,
   `holita-seed.mts`) into `osnova/tools/` or `holita/tools/`, and let Discocan's database setup
   use the shared Osnova setup like Holita.

## Open items

- Before the next ERM deploy, repoint the `discocan-erm-*` user units to `discocan/apps/erm-server`
  and the inactive `holita-erm-relay` unit to `discocan/tools/erm-relay/relay.mts`. It restarts the
  ERM gateway, so the owner picks the moment.
- The 60-case test budget is shared by both products (50 used) and stays at 60 (owner,
  2026-11-18): Holita's isolation and contract tests extend existing cases with internal tables.
- `npm run format:check` fails on 14 tracked files that predate the move.
- Later: OpenID Connect sign-in, cart/checkout/orders, the storefront rendering engine, per-product
  CI and `osnova/` as its own repository.
