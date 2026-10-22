---
name: holita-admin-development
description: Review or extend the connected holita Discocan Fleet admin using shared screen presentation, generated Gateway contracts and scoped Apollo lifecycles. Not for backend implementation.
---

# Holita Discocan Angular admin development

Read [AGENTS.md](../../../AGENTS.md) and apply the [Discocan instructions](../../../docs/discocan/instructions.md).
Use the official [angular-developer](../angular-developer/SKILL.md) skill for framework conventions
and the PrimeNG plugin for current component APIs. Open the
[architecture](../../../docs/discocan/architecture.md#angular-admin-foundation) or the
[Fleet index](../../../docs/discocan/fleet.md) only for the section you need.

## Where things are

- [app.config.ts](../../../apps/admin/src/app/app.config.ts) configures routing, HTTP, the theme
  and Branch discovery. Startup config chooses the Gateway URL and availability.
- [AdminWorkspace](../../../apps/admin/src/app/workspace/admin-workspace.ts) owns the session,
  language, login and shell.
  - [BranchContext](../../../apps/admin/src/app/features/branches/branch-context.ts) owns Branch
    discovery, selection and routing.
  - [Login](../../../apps/admin/src/app/features/auth/login.ts) selects a Tenant, then a Branch,
    and opens Overview.
  - Karma uses the session and language without BranchContext.
- [FleetWorkspace](../../../apps/admin/src/app/features/fleet/fleet-workspace.ts) gates
  availability and preferences, and keys business views by session, Branch, language and resource.
- [graphqlOptions](../../../apps/admin/src/app/core/graphql/graphql-options.ts) captures the
  session, Branch and language headers. Every mounted feature owns its Apollo client and cache.
- Routes are in [fleet.routes.ts](../../../apps/admin/src/app/features/fleet/fleet.routes.ts).

Connected features live under `apps/admin/src/app/features/fleet/<feature>/`. Each one has:

- `<feature>-page.ts`, the routed adapter;
- an `*-api.ts`, which calls named operations from `operations.graphql`;
- `*-query.ts`, the explicit URL-state → filter/sort mapping;
- `*-mapping.ts`, the mapping between generated types and view rows and forms;
- a shared presentation view and drawer.

Vehicles is the reference feature, with `vehicles-page.ts`, `vehicle-editor-page.ts`,
`vehicles-api.ts`, `vehicle-query.ts` and `vehicle-mapping.ts`.

## Rules

- Keep named operations beside features and consume the generated TypedDocumentNodes. Run codegen
  and schema:check after operation changes.
- Business editors use typed Reactive Forms with explicit mapping. Server `fieldErrors` map to
  their controls.
- Keep list state in the URL through `UrlListState` and the feature's `ListDefinition`. Map only
  the backend's supported `allOf` predicates and sort fields.
- Submitted writes keep the client that started them. A Branch, language or session change creates
  fresh clients.
- Converting display units and time zones must never change submitted canonical values (km, km/h,
  litres, integer EUR cents).
- Live restart, firmware policy and signal/voltage have no provider contract and stay
  unavailable.
- Presentation follows the [admin design-system skill](../holita-admin-design-system/SKILL.md).
  Keep the Bulgarian/English catalogs, light/dark themes and loading/error/empty states.
- Do not import Storybook fixtures into application code.

## Checks

Use [focused validation](../holita-focused-validation/SKILL.md): run `npm run check` once when
handing over. A change to login, routing, transport or a main journey also runs the matching file
of `npm run test:smoke:admin`. Do not add specs beyond the
[delivery policy](../../../AGENTS.md#delivery-policy).
