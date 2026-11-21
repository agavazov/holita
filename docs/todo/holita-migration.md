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

| Ticket                                                                           | Wave | Status | Depends on         |
| -------------------------------------------------------------------------------- | ---- | ------ | ------------------ |
| [101 Brands, the reference feature](101-holita-brands.md)                        | 0    | Ready  |                    |
| [102 Demo shop data](102-holita-demo-shop.md)                                    | 0    | Ready  | 101                |
| [103 Category tree](103-holita-categories.md)                                    | 1    | Ready  | 102                |
| [104 Product options](104-holita-options.md)                                     | 1    | Ready  | 102                |
| [105 Product variants](105-holita-variants.md)                                   | 1    | Ready  | 104                |
| [106 Product editor and descriptions](106-holita-product-editor.md)              | 1    | Ready  | 103, 105           |
| [107 Product image gallery](107-holita-product-images.md)                        | 1    | Ready  | 106                |
| [108 Product collections](108-holita-collections.md)                             | 1    | Ready  | 103                |
| [109 Product characteristics](109-holita-characteristics.md)                     | 1    | Ready  | 106                |
| [110 Product badges and tags](110-holita-badges-tags.md)                         | 1    | Ready  | 106                |
| [111 Inventory list and adjustments](111-holita-inventory.md)                    | 1    | Ready  | 105                |
| [112 Storefront catalogue browsing](112-holita-storefront-browsing.md)           | 2    | Ready  | 107, 108, 110, 111 |
| [113 Storefront product variant choice](113-holita-storefront-variant-choice.md) | 2    | Ready  | 107, 109, 111      |
| [114 Shopper cart](114-holita-cart.md)                                           | 2    | Ready  | 113                |
| [115 Checkout form and manual quote](115-holita-checkout-quote.md)               | 2    | Ready  | 114                |
| [116 Checkout order placement](116-holita-place-order.md)                        | 2    | Ready  | 115                |
| [117 Shopper order history](117-holita-shopper-orders.md)                        | 2    | Ready  | 116                |
| [118 Admin order management](118-holita-admin-order-management.md)               | 3    | Ready  | 117                |
| [119 Manual orders in Admin](119-holita-admin-manual-orders.md)                  | 3    | Ready  | 118                |
| [120 Admin customer detail](120-holita-customer-detail.md)                       | 3    | Ready  | 118                |
| [121 Discounts and promo codes](121-holita-discounts.md)                         | 3    | Ready  | 118                |
| [122 Admin manual payment and shipping methods](122-holita-manual-methods.md)    | 3    | Ready  | 115, 118           |
| [123 Shop content pages](123-holita-pages.md)                                    | 3    | Ready  | 102                |
| [124 Shop blog](124-holita-blog.md)                                              | 3    | Ready  | 102                |
| [125 Shop navigation menus](125-holita-navigation.md)                            | 3    | Ready  | 112, 123, 124      |
| [126 General shop settings](126-holita-general-settings.md)                      | 3    | Ready  | 102                |
| [127 Admin shop dashboard](127-holita-dashboard.md)                              | 3    | Ready  | 111, 118, 120      |
