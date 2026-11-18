# Two products on a shared architecture

Owner direction, 2026-11-18. The repository keeps Discocan and Holita together while the shared
architecture is proven on both; a split is a later owner decision. The priorities are one visual
system for every operator screen, then one shared architecture. The goal now is a working
architecture with a thin Holita slice, not a port of the old platform.

## Decisions

- Top-level `discocan/`, `holita/` and `osnova/` in one npm/Nx workspace
  ([boundaries](../../AGENTS.md#products-and-boundaries)).
- `osnova/` is extracted from Discocan, never copied: the design system and admin shell first,
  then Core with the sign-in, the gateway base and the generic tooling.
- Products use `osnova/` only through `@osnova/*` package names, so that it can become its own
  repository later without changing product code.
- Each product runs its own Core instance, databases, gateway and ports.
- Sign-in stays the Core session for now, behind a seam that OAuth/OpenID Connect can replace.
- Holita has an operator graph and a separate public storefront graph
  ([Holita rules](../../holita/AGENTS.md)).
- Listings are shared presentational patterns with override points, not a generic CRUD framework.

## Steps

1. Move product documentation under each product and rename the `discocan-*` skills that describe
   the shared skeleton.
2. Extract the design system, shell and listings into `osnova/packages/ui`. The Discocan admin
   must look the same before and after.
3. Move Core, the sign-in and the gateway base to `osnova/` and make the tooling product-aware
   (subgraphs, databases and ports per product). Add product tags to the module-boundary rule.
4. Holita thin slice on the operator graph: Backoffice (merchants and shops), Admin (products
   with name, price and status; customers) and Sales (one basic list).
5. Holita storefront on its own graph: product list, product page, shopper registration and
   sign-in per shop.

## Open items

- Before the next ERM deploy, repoint the `discocan-erm-*` user units to `discocan/apps/erm-server`
  and the inactive `holita-erm-relay` unit to `discocan/tools/erm-relay/relay.mts`. Owner step.
- Take a database dump before step 3 changes the Core configuration.
- The 60-case test budget is shared by both products; a per-product budget needs the owner.
- `npm run format:check` fails on 14 tracked files that predate the move.
- Later: OpenID Connect sign-in, the storefront rendering engine and `osnova/` as its own
  repository.
