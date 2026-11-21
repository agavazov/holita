---
name: holita-feature
description: Deliver a Holita merchant or storefront feature through Commerce, the graph contracts, the shared Admin UI and the demo shop.
---

# Holita feature

Read the [workspace guide](../../../AGENTS.md), [Holita rules](../../../holita/AGENTS.md)
and the ticket in the [migration queue](../../../docs/todo/holita-migration.md).
Use the ticket to choose which layers the feature changes.

## Commerce and contracts

- Follow the [backend skill](../osnova-backend-feature/SKILL.md) for persistence, validation and
  lists. Add Commerce Prisma models and additive migrations for new persisted data.
- Use a concrete repository and service. Require verified `tenantId` and `branchId` on every
  Commerce read and write. Resolve the storefront Branch from the request and derive its Tenant
  from the verified Branch. Limit unauthenticated storefront queries to public records in that
  Branch.
- Authorize guest cart, checkout and order confirmation with the shop-scoped cart credential.
  Require the shop customer's verified session for account orders.
- Define operator operations in operator SDL and shopper-facing operations in storefront SDL,
  over the same Commerce services. Keep operator fields out of the storefront graph. Regenerate
  contracts and run schema checks when SDL or operations change.
- Copy the Brands pilot for catalogue references: a composite Tenant/Branch foreign key protects
  assignments, and the storefront maps related records only when they are public.

## Admin and storefront

- Use the [Admin skill](../osnova-admin-development/SKILL.md) for named operations, generated
  TypedDocumentNodes, scope and typed Reactive Forms. Follow the
  [design system skill](../osnova-admin-design-system/SKILL.md) for shared patterns and loading,
  empty and error states. Use routed drawers for entity editors and the shared full-page view
  for General Settings.
- Keep named operations beside the Admin feature, register them in the operator graph generator,
  and capture shop, session and language in its concrete Apollo service. Use `UrlListState` and
  explicit `TablePanel` columns. Let the drawer notify its retained list through `DrawerHost`.
- Add BG/EN strings for changed Admin and storefront surfaces. Capture screenshots of every new
  or changed screen at 1440×900 and 390×844, in light and dark.

## Demo shop and validation

- Extend the [demo shop seed](../../../holita/tools/holita-seed.mts) with the ticket's fixtures.
  Insert only. Use existing fixtures as references or insert new rows when adding fields to a
  fixture would require an update. A second run should leave existing data unchanged.
- Follow the [validation skill](../osnova-focused-validation/SKILL.md) and workspace test budget.
  Add or extend tests only for cases the delivery policy permits.
- For Holita login, routing, transport or main journey changes, run one relevant smoke file
  with `npm run test:smoke:holita -- <file>`.

## Development image storage

Commerce writes and serves brand and product images from the Git-ignored local
`.volumes/holita/images/` directory. Define `HOLITA_COMMERCE_IMAGE_DIR` in
`holita/config/commerce.env` and document it in the root [environment example](../../../.env.example).
Use an absolute directory path. The demo seed writes generated images to the same directory.

Only authorized operators can upload, replace or remove images in the selected shop. Accept JPEG,
PNG and WebP up to 5 MiB and validate the content type from the file. Keep media references
shop-scoped. Brands accepts the logo with the operator mutation, so a rejected write cannot
publish a file. Preserve an omitted logo and remove it on explicit null. Operator previews fetch
bytes with authorization and release their object URLs when the draft changes or closes.
Scope every file fetch to the verified Tenant and Branch. Anonymous reads require a currently
visible storefront attachment in that shop. Serve media from Commerce on the Admin and
storefront origins, including in the browser smoke harness.
