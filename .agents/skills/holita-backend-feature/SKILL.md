---
name: holita-backend-feature
description: Implement or change holita backend GraphQL features using the actual Products reference, generated contracts, scoped persistence and focused tests. Use for backend feature work, not frontend-only changes.
---

# Backend feature reference

Read [AGENTS.md](../../../AGENTS.md), the relevant requirements and
[architecture](../../../docs/architecture/overview.md). Keep the task within the user's
authorized scope; this skill does not authorize unrelated features or infrastructure.

Follow the real Products files:

- [SDL](../../../apps/products/src/products/products.graphql) defines inputs, outputs and defaults.
- [Resolver](../../../apps/products/src/products/products.resolver.ts) uses generated argument
  types and delegates to the [service](../../../apps/products/src/products/products.service.ts).
- The [repository](../../../apps/products/src/products/products.repository.ts) requires storeId
  for every operation and includes it in every persistence predicate. Write inputs never own storeId.
- [Core client](../../../apps/products/src/core/core.client.ts) checks existence only for
  creation, using a generated operation and a request-local promise cache. Preserve product-only
  read/update/delete behavior when core is unavailable.

For a contract change, edit the owning SDL and affected named operations, then run
`npm run codegen` and `npm run schema:check`. Never edit generated output or infer the API
from Prisma. Keep validation explicit; generated TypeScript does not validate runtime input.
For persistence changes, review a new service-owned migration and preserve existing data.

Start with `npm run test:products -- products.service.spec.ts`, narrowed by file/case as
appropriate. Use `test:products:db -- products.db.spec.ts` for real scoping/CRUD checks and
`test:gateway:db -- federation.db.spec.mts` when communication, context or federation changes.
Read [testing](../../../docs/testing.md) for prerequisites and the current coverage map.
Mocks prove service decisions, not database or federation isolation. Never run test:full
automatically. Update the existing requirements/docs with the implemented behavior.

Reference Venues applies the same lifecycle in its own service and admin feature. Follow
`apps/reference/src/venues` and `apps/admin-react/src/features/reference/venues` when extending
Reference. Use test:reference/test:reference:db with venues.service.spec.ts/venues.db.spec.ts,
and test:admin-react/test:smoke:admin-react with the relevant Venue/Reference file. Keep the Reference
availability guard and prefixed public contracts.

Use the [Reference implementation index](../../../docs/reference.md) for Event relations,
Session ordering, direct uploads, atomic lifecycle actions and transactional history.
Keep each feature's concrete service/repository boundaries and select the linked checks
for the behavior being changed.
