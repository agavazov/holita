# Ecommerce contributor instructions

Apply the shared [coding guide](../../AGENTS.md), then read [the domain index](README.md)
and [Stores foundation](stores.md) before changing store behavior.

- Keep online-store documentation under `docs/ecommerce/`. Use Store for an online shop;
  Discocan's future Branch is a separate domain concept.
- Core currently owns Tenant/Store persistence and discovery. Store access always includes
  the verified Tenant. Preserve tenant-scoped federation reference resolution and seed idempotency.
- Distinguish implemented Store discovery from online-store business features. Do not describe
  storefront, catalog, cart, checkout or orders as available.
- The existing Angular Vehicles/Devices workspace is Discocan. Its Fleet navigation and
  Truck/IMEI rules do not define Ecommerce workflows. Shared Angular and backend conventions
  still apply; add a business feature only when requested.
- Core contract changes can affect the current Discocan consumer. Check both domain documents
  when changing the shared Store API and select validation for the actual affected behavior.
