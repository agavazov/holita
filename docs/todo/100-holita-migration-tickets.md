# 100 Migration tickets and feature skill

**Status:** Ready. **Product:** Holita.

## Background

Holita (`holita/`) has Core sign-in for operators, Admin with Products (name, price, status) and
Customers, Backoffice, Sales, the Commerce service with an operator graph and a public storefront
graph, and a basic storefront with catalogue, product page and shopper sign-in. The old platform
red.bg (`/workspace/projects/red.bg/workspace-ecommerce`) is the reference; its inventory is
[holita/docs/red-bg/](../../holita/docs/red-bg/README.md). The queue and the owner's defaults are in
[holita-migration.md](holita-migration.md).

## Goal

Every implemented red.bg merchant-shop feature for waves 1-3 has a ticket that one Codex run can
finish, and a short skill defines when a Holita feature is done.

## Steps

1. Read the inventory, then the red.bg sources the waves need:
   `services/api` (models, migrations, services), `services/admin` (routes, Blade screens) and
   `services/storefront/basic` (routes, views). Skip what the queue excludes and Admin links that
   lead to coming-soon placeholders.
2. Write one ticket per feature, numbered from 103 upward, in dependency order:
   - **Wave 1, catalogue:** category tree; options and product variants (SKU, price, stock); full
     product editor (BG/EN descriptions, images); collections; characteristics; badges and tags;
     inventory.
   - **Wave 2, storefront:** browsing by category, brand and filters; product page with variant
     choice; cart; checkout with manual payment and shipping; the shopper's orders.
   - **Wave 3, operations:** orders in Admin; customer detail; discounts and promo codes; manual
     payment and shipping methods; pages; navigation; blog; general settings; dashboard.

   Split a feature when it is too big for one run; merge trivial ones. Each ticket follows
   [the backlog format](README.md) and names: the red.bg sources (paths), the fields kept (enough
   for a real shop, not every red.bg column), the Admin screens, the storefront impact, what the
   demo shop seed adds, "Done when" and the tickets it depends on. A choice that truly needs the
   owner becomes its own `Needs owner` ticket; everything else is decided in the ticket by the
   owner defaults.

3. Write the skill `.agents/skills/holita-feature/SKILL.md`, at most 80 lines, with front matter
   like the other skills. It holds the definition of done for a Holita feature and links the
   existing `osnova-*` skills instead of repeating them:
   - Commerce Prisma model with an additive migration;
   - operator SDL, plus storefront SDL when shoppers see the feature;
   - concrete repository and service with verified Tenant/Branch scoping;
   - an Admin page from the shared Osnova patterns with a drawer editor and typed Reactive Forms;
   - BG/EN texts;
   - insert-only seed data, extending the demo shop seed;
   - tests only as the delivery policy allows;
   - screenshots of every new or changed screen at 1440x900 and 390x844, light and dark.

   The skill also decides where uploaded images live: on local disk, Git-ignored, configured in
   `holita/config/commerce.env` and the root `.env.example`, written and served by Commerce.

4. Add every new ticket as a row to the queue in [holita-migration.md](holita-migration.md) with
   wave, status and dependencies. Do not edit [README.md](README.md).

## Done when

- Tickets 103 onward exist for waves 1-3, each small enough for one Codex run and ordered by
  dependency, and the queue lists them.
- The skill exists, is at most 80 lines and links the `osnova-*` skills.
- Only documentation changed; `npm run format` leaves no diff.

## Limits

- Documentation only: no code, schema or configuration changes.
- Read only `red.bg/workspace-ecommerce`; Sales CRM (`workspace-sales`) is excluded.
- Do not copy red.bg code or long passages; link the sources.

## References

- [Holita rules](../../holita/AGENTS.md), [workspace guide](../../AGENTS.md)
- [Backend skill](../../.agents/skills/osnova-backend-feature/SKILL.md),
  [Admin skill](../../.agents/skills/osnova-admin-development/SKILL.md),
  [design system skill](../../.agents/skills/osnova-admin-design-system/SKILL.md),
  [validation skill](../../.agents/skills/osnova-focused-validation/SKILL.md)
