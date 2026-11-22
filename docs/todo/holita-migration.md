# Holita migration queue

The owner approved on 2026-11-21 to migrate every implemented red.bg merchant-shop feature into
Holita, excluding external integrations. This file is the queue; each open row links one ticket written
as [the backlog index](README.md) describes. Holita tickets are numbered from 100 upward.

## Owner defaults

- Shop first: Admin catalogue, storefront and orders, before Backoffice and Sales depth.
- Payments and shipping only as manual methods, without providers.
- Product and brand images on local disk in development, Git-ignored and served through Commerce.
- Each ticket is committed locally and never pushed. One Codex run at a time, in the main checkout.
- Excluded: ERP, marketplaces, marketing connectors, feeds, courier and payment-provider APIs,
  webhooks, theme engines and the theme editor, MCP, the marketing website, the crawler and
  telephony.
- Owner, 2026-11-22: wave 4 adds the sales process in the Sales application (tickets 131-146);
  the crawler, telephony, SMS, browser sessions and external providers stay excluded. Wave 5
  (ticket 130) audits what is still missing and plans it. Only red.bg screens that are implemented are migrated; placeholders are not.

## Queue

Work top to bottom; a ticket starts only when the tickets it depends on are done.

| Ticket                                                                                           | Wave | Status | Depends on           |
| ------------------------------------------------------------------------------------------------ | ---- | ------ | -------------------- |
| [119 Manual orders in Admin](119-holita-admin-manual-orders.md)                                  | 3    | Ready  |                      |
| [120 Admin customer detail](120-holita-customer-detail.md)                                       | 3    | Ready  |                      |
| [121 Discounts and promo codes](121-holita-discounts.md)                                         | 3    | Ready  |                      |
| [122 Admin manual payment and shipping methods](122-holita-manual-methods.md)                    | 3    | Ready  |                      |
| [123 Shop content pages](123-holita-pages.md)                                                    | 3    | Ready  |                      |
| [124 Shop blog](124-holita-blog.md)                                                              | 3    | Ready  |                      |
| [125 Shop navigation menus](125-holita-navigation.md)                                            | 3    | Ready  | 123, 124             |
| [126 General shop settings](126-holita-general-settings.md)                                      | 3    | Ready  |                      |
| [127 Admin shop dashboard](127-holita-dashboard.md)                                              | 3    | Ready  | 120                  |
| [131 Establish the Sales subgraph](131-holita-sales-sales-service.md)                            | 4    | Ready  |                      |
| [132 Manage prospect records](132-holita-sales-leads.md)                                         | 4    | Ready  | 131                  |
| [133 Manage lead contacts](133-holita-sales-contacts.md)                                         | 4    | Ready  | 132                  |
| [134 Track leads through pipeline stages](134-holita-sales-pipeline.md)                          | 4    | Ready  | 132                  |
| [135 Assign leads to Core sales agents](135-holita-sales-agent-assignment.md)                    | 4    | Ready  | 132                  |
| [136 Record lead notes and activity](136-holita-sales-notes.md)                                  | 4    | Ready  | 135                  |
| [137 Schedule and complete lead tasks](137-holita-sales-tasks.md)                                | 4    | Ready  | 134, 135, 136        |
| [146 Save lead follow-up in Quick Work](146-holita-sales-quick-work.md)                          | 4    | Ready  | 137                  |
| [138 Prepare and track priced offers](138-holita-sales-offers.md)                                | 4    | Ready  | 133                  |
| [139 Configure appointment services and availability](139-holita-sales-appointment-services.md)  | 4    | Ready  | 131                  |
| [140 Book and manage sales appointments](140-holita-sales-bookings.md)                           | 4    | Ready  | 135, 139             |
| [143 Provision a merchant and first shop atomically](143-holita-sales-core-provisioning.md)      | 4    | Ready  | 131                  |
| [141 Convert a won lead to a new merchant and shop](141-holita-sales-won-lead-conversion.md)     | 4    | Ready  | 133, 134, 143        |
| [144 Hand off a won lead to an existing merchant](144-holita-sales-existing-merchant-handoff.md) | 4    | Ready  | 141                  |
| [145 Manage prospect online stores](145-holita-sales-online-stores.md)                           | 4    | Ready  | 131                  |
| [142 Show the daily sales dashboard](142-holita-sales-dashboard.md)                              | 4    | Ready  | 137, 138, 140, 144   |
| [130 Audit what is still missing and plan it](130-holita-gap-audit.md)                           | 5    | Ready  | All wave 1–4 tickets |
