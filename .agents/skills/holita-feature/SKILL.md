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
- Give each Commerce feature a Nest module with its concrete repository, service and storage
  providers. Import it in the graphs that use it. Keep `DatabaseModule` for `DatabaseService`.
- Require verified `tenantId` and `branchId` on every Commerce read and write. Resolve the
  storefront Branch from the request and derive its Tenant from the verified Branch. Limit
  unauthenticated storefront queries to public records in that Branch.
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
  explicit `TablePanel` columns inside `.app-view`. Supply localized `moduleInfo` through the
  shared page header. Let the drawer notify its retained list through `DrawerHost`.
- Add BG/EN strings for changed Admin and storefront surfaces. Capture screenshots of every new
  or changed screen at 1440×900 and 390×844, in light and dark.

## Demo shop and validation

- **Demo shop seed.** Extend the Bulgarian homewares
  [catalogue fixtures](../../../holita/tools/demo-catalogue.mts) and the
  [seed that loads them](../../../holita/tools/holita-seed.mts). Keep fixture IDs stable.
  Insert only. Reuse existing fixtures as references or give new examples their own IDs when
  adding fields would require an update. Generate artwork locally and keep the source PNGs in
  `holita/config/demo/` for the seed to copy into the configured image directory.
  A second run should insert nothing and leave existing rows and files unchanged.
- Follow the [validation skill](../osnova-focused-validation/SKILL.md) and workspace test budget.
  Add or extend tests only for cases the delivery policy permits.
- For Holita login, routing, transport or main journey changes, run one relevant smoke file
  with `npm run test:smoke:holita -- <file>`.

## Brand logo pattern

Commerce writes and serves brand logos from the Git-ignored local
`.volumes/holita/images/` directory. Define `HOLITA_COMMERCE_IMAGE_DIR` in
`holita/config/commerce.env` and document it in the root [environment example](../../../.env.example).
Use an absolute path. The demo seed writes its generated logos to the same directory.

Authorized operators send a base64 logo with the brand mutation for the selected shop. Commerce
checks the file signature and accepts JPEG, PNG and WebP up to 5 MiB. Omit the logo to keep its
key, or send null to remove it. Persist the shop-scoped key on a successful write.
Admin previews fetch bytes with authorization and release their object URLs when the draft
changes or closes. Commerce scopes every read to the verified Tenant and Branch, and serves an
anonymous request only for a logo attached to an active brand in that shop. Proxy `/media/brands/`
through the Admin and storefront origins, including in browser smoke. Product media is tracked
in [ticket 107](../../../docs/todo/107-holita-product-images.md).
