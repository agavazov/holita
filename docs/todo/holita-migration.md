# Holita migration queue

The owner approved on 2026-11-21 to migrate every implemented red.bg merchant-shop feature into
Holita, excluding external integrations. This file is the queue; each row links one ticket written
as [the backlog index](README.md) describes. Holita tickets are numbered from 100 upward.

## Owner defaults

- Shop first: Admin catalogue, storefront and orders, before Backoffice and Sales depth.
- Payments and shipping only as manual methods, without providers.
- Product and brand images on local disk in development, Git-ignored and served through Commerce.
- Each ticket is committed locally and never pushed. One Codex run at a time, in the main checkout.
- Excluded: ERP, marketplaces, marketing connectors, feeds, courier and payment-provider APIs,
  webhooks, theme engines and the theme editor, MCP, the marketing website, Sales CRM, the crawler
  and telephony. Only red.bg screens that are implemented are migrated; placeholders are not.

## Queue

Work top to bottom; a ticket starts only when the tickets it depends on are done.

| Ticket                                                                     | Wave | Status | Depends on |
| -------------------------------------------------------------------------- | ---- | ------ | ---------- |
| [100 Migration tickets and feature skill](100-holita-migration-tickets.md) | 0    | Ready  |            |
| [101 Brands, the reference feature](101-holita-brands.md)                  | 0    | Ready  | 100        |
| [102 Demo shop data](102-holita-demo-shop.md)                              | 0    | Ready  | 101        |
