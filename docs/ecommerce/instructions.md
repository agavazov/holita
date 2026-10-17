# Ecommerce contributor instructions

Apply the shared [coding guide](../../AGENTS.md), then read [the domain index](README.md)
and [Branches foundation](branches.md) before changing branch behavior.

- Keep online-shop documentation under `docs/ecommerce/`. Branch represents an online shop
  here and a vehicle fleet in Discocan. Both domains use the shared Core Branch model.
- Core currently owns Tenant/Branch persistence and discovery. Branch access always includes
  the verified Tenant. Preserve tenant-scoped federation reference resolution and seed idempotency.
- Distinguish implemented Branch discovery from online-shop business features. Do not describe
  storefront, catalog, cart, checkout or orders as available.
- The existing Angular Vehicles/Devices workspace is Discocan. Its Fleet navigation and
  Truck/IMEI rules do not define Ecommerce workflows. Shared Angular and backend conventions
  still apply; add a business feature only when requested.
- Core contract changes can affect the current Discocan consumer. Check both domain documents
  when changing the shared Branch API and select validation for the actual affected behavior.
