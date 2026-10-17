# Shared foundation requirements

| ID      | Implemented requirement                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FND-001 | holita naming, npm workspaces, existing lockfile and Nx with five host applications: admin, gateway, core, fleet and karma-client.                                |
| FND-002 | Strict TypeScript, concrete feature services/repositories, no cross-application implementation/model imports and no generic CRUD layer.                           |
| FND-003 | PostgreSQL-only Compose infrastructure; Core/Fleet own separate development/test databases, roles, Prisma clients and reviewed SQL migrations.                    |
| FND-005 | Schema-first federation, explicit offline operation/codegen inputs, generated ignored outputs and runtime SDL assets. Gateway uses a static supergraph.           |
| FND-007 | Request ID propagation, bounded upstream timeouts, standard Nest exceptions and hidden unexpected errors. Health works without database/downstream access.        |
| FND-019 | Focused native runner selectors, isolated per-run DB schemas/processes, noncached DB/browser checks, real PR base/head selection and manual-only full regression. |

Product identity for this repository and its current resources is holita; red.bg is the temporary
presentation domain. Domain requirements are documented separately:

- [Discocan requirements](../discocan/requirements.md): implemented Fleet and telemetry admin behavior.
- [Ecommerce Branches](../ecommerce/branches.md): implemented Branch foundation.

Health proves application response, not database readiness or downstream service availability.
