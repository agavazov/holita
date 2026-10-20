# Ecommerce contributor instructions

Apply the shared [coding guide](../../AGENTS.md), then read [the domain index](README.md)
and [Branches foundation](branches.md) before changing branch behavior.

- Keep online-shop documentation under `docs/ecommerce/`. Branch represents an online shop
  here and a vehicle fleet in Discocan. Both domains use the shared Core Branch model.
- Core currently owns Tenant/Branch persistence and discovery. Branch access always includes
  the verified Tenant. Preserve tenant-scoped federation reference resolution and seed idempotency.
- Branch rename additionally requires valid selected `x-branch-id` context matching the mutation
  ID. It changes only the name (trimmed, 1–80 Unicode code points, no NUL), returns `name` field
  errors for invalid input and NOT_FOUND for a missing/foreign scoped target. Preserve the ID,
  Tenant, stored references and insert-only seed behavior.
- Distinguish implemented Branch discovery from online-shop business features. Do not describe
  storefront, catalog, cart, checkout or orders as available.
- The existing Angular Vehicles/Devices workspace is Discocan. Its Fleet navigation and
  Truck/IMEI rules do not define Ecommerce workflows. Shared Angular and backend conventions
  still apply; add a business feature only when requested.
- Core contract changes can affect the current Discocan consumer. Check both domain documents
  when changing the shared Branch API and select validation for the actual affected behavior.
