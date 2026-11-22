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
  holds the tickets from the gap audit; Needs owner rows wait for an owner decision. Only red.bg screens that are implemented are migrated; placeholders are not.

## Queue

Work top to bottom; a ticket starts only when the tickets it depends on are done.

| Ticket                                                                                                   | Wave | Status      | Depends on         |
| -------------------------------------------------------------------------------------------------------- | ---- | ----------- | ------------------ |
| [127 Admin shop dashboard](127-holita-dashboard.md)                                                      | 3    | Ready       |                    |
| [131 Establish the Sales subgraph](131-holita-sales-sales-service.md)                                    | 4    | Ready       |                    |
| [132 Manage prospect records](132-holita-sales-leads.md)                                                 | 4    | Ready       | 131                |
| [133 Manage lead contacts](133-holita-sales-contacts.md)                                                 | 4    | Ready       | 132                |
| [134 Track leads through pipeline stages](134-holita-sales-pipeline.md)                                  | 4    | Ready       | 132                |
| [135 Assign leads to Core sales agents](135-holita-sales-agent-assignment.md)                            | 4    | Ready       | 132                |
| [136 Record lead notes and activity](136-holita-sales-notes.md)                                          | 4    | Ready       | 135                |
| [137 Schedule and complete lead tasks](137-holita-sales-tasks.md)                                        | 4    | Ready       | 134, 135, 136      |
| [146 Save lead follow-up in Quick Work](146-holita-sales-quick-work.md)                                  | 4    | Ready       | 137                |
| [138 Prepare and track priced offers](138-holita-sales-offers.md)                                        | 4    | Ready       | 133                |
| [139 Configure appointment services and availability](139-holita-sales-appointment-services.md)          | 4    | Ready       | 131                |
| [140 Book and manage sales appointments](140-holita-sales-bookings.md)                                   | 4    | Ready       | 135, 139           |
| [143 Provision a merchant and first shop atomically](143-holita-sales-core-provisioning.md)              | 4    | Ready       | 131                |
| [141 Convert a won lead to a new merchant and shop](141-holita-sales-won-lead-conversion.md)             | 4    | Ready       | 133, 134, 143      |
| [144 Hand off a won lead to an existing merchant](144-holita-sales-existing-merchant-handoff.md)         | 4    | Ready       | 141                |
| [145 Manage prospect online stores](145-holita-sales-online-stores.md)                                   | 4    | Ready       | 131                |
| [142 Show the daily sales dashboard](142-holita-sales-dashboard.md)                                      | 4    | Ready       | 137, 138, 140, 144 |
| [252 Preserve stock deductions on manual order edits](252-holita-manual-order-stock-deltas.md)           | 5    | Ready       |                    |
| [152 Use the maintained phone in new manual orders](152-holita-manual-order-customer-phone.md)           | 5    | Ready       |                    |
| [199 Capture a separate checkout billing address](199-holita-checkout-billing-address.md)                | 5    | Ready       |                    |
| [200 Add a shopper note at checkout](200-holita-checkout-shopper-note.md)                                | 5    | Ready       |                    |
| [223 Alert merchants to new orders in one shop inbox](223-holita-admin-order-notifications.md)           | 5    | Ready       |                    |
| [175 Import catalogue rows from a fixed-format local CSV](175-holita-catalogue-file-import.md)           | 5    | Ready       |                    |
| [156 Show storefront account, sign-in and cart request states](156-holita-storefront-account-states.md)  | 5    | Ready       |                    |
| [192 Create contact-only customers in Admin](192-holita-admin-customer-create.md)                        | 5    | Ready       |                    |
| [197 Manage saved addresses as shopper or merchant](197-holita-shopper-address-book.md)                  | 5    | Ready       |                    |
| [198 Use saved addresses at checkout](198-holita-checkout-saved-address.md)                              | 5    | Ready       | 197                |
| [206 Download the existing issued invoice snapshot](206-holita-invoice-download.md)                      | 5    | Ready       |                    |
| [203 Save invoice issuer defaults](203-holita-invoice-issuer-settings.md)                                | 5    | Ready       |                    |
| [204 List invoices across the shop](204-holita-invoice-register.md)                                      | 5    | Ready       |                    |
| [207 Find and download issued invoices in shopper accounts](207-holita-shopper-invoice-history.md)       | 5    | Ready       | 206                |
| [184 Suggest products during storefront search](184-holita-storefront-search-suggestions.md)             | 5    | Ready       |                    |
| [164 Show the photo for the selected variant](164-holita-variant-gallery-photo.md)                       | 5    | Ready       |                    |
| [226 Edit product and category SEO metadata](226-holita-catalogue-seo-metadata.md)                       | 5    | Ready       |                    |
| [221 Report shop sales over a merchant-selected date range](221-holita-admin-sales-report.md)            | 5    | Ready       |                    |
| [176 Inspect catalogue imports and retry failed work](176-holita-catalogue-import-history.md)            | 5    | Ready       | 175                |
| [201 Review and decide order return cases in Admin](201-holita-admin-return-cases.md)                    | 5    | Ready       |                    |
| [215 Accept authenticated shopper return requests through the API](215-holita-shopper-return-request.md) | 5    | Ready       | 201                |
| [202 Record the manual refund for an approved return](202-holita-admin-return-refund.md)                 | 5    | Ready       | 215, 252           |
| [222 Show best sellers and category sales](222-holita-admin-sales-breakdowns.md)                         | 5    | Ready       | 221                |
| [154 Translate demo catalogue labels and repair demo SKU references](154-holita-demo-backfilled-skus.md) | 5    | Ready       |                    |
| [159 Show shop picker loading and failures](159-holita-admin-shop-picker-states.md)                      | 5    | Ready       |                    |
| [160 Show a shop-scoped storefront not-found page](160-holita-storefront-not-found.md)                   | 5    | Ready       |                    |
| [162 Localize empty states in Admin selectors](162-holita-admin-select-empty-texts.md)                   | 5    | Ready       |                    |
| [155 Show missing merchant and empty shops](155-holita-merchant-detail-states.md)                        | 5    | Ready       |                    |
| [158 Localize operator request failures](158-holita-operator-error-texts.md)                             | 5    | Ready       | 155                |
| [165 Enforce the selected variant's minimum purchase quantity](165-holita-variant-minimum-quantity.md)   | 5    | Ready       |                    |
| [167 Filter inventory by catalogue attributes](167-holita-inventory-filters.md)                          | 5    | Ready       |                    |
| [163 Show variant compare-at prices](163-holita-variant-compare-at-price.md)                             | 5    | Ready       |                    |
| [166 Record and search variant barcodes](166-holita-variant-barcode.md)                                  | 5    | Ready       |                    |
| [168 Combine rule conditions in automatic collections](168-holita-collection-rules.md)                   | 5    | Ready       |                    |
| [169 Rank and cap automatic collections](169-holita-collection-order-and-limit.md)                       | 5    | Ready       | 168                |
| [170 Scope characteristic groups to categories](170-holita-category-characteristics.md)                  | 5    | Ready       |                    |
| [171 Add reusable characteristic choices](171-holita-characteristic-choice-fields.md)                    | 5    | Ready       | 170                |
| [172 Display variant colors as labelled swatches](172-holita-option-colour-chips.md)                     | 5    | Ready       |                    |
| [173 Show selected option values on catalogue cards](173-holita-catalogue-option-preview.md)             | 5    | Ready       | 172                |
| [179 Manage shop logo and favicon](179-holita-shop-branding.md)                                          | 5    | Ready       | 126                |
| [180 Configure storefront languages by shop](180-holita-shop-locales.md)                                 | 5    | Ready       |                    |
| [188 Configure fixed Basic homepage content and announcement](188-holita-basic-home-content.md)          | 5    | Ready       | 126                |
| [185 Preview the cart without leaving the page](185-holita-storefront-cart-preview.md)                   | 5    | Ready       |                    |
| [182 Manage shop inquiries in Admin](182-holita-admin-inquiry-inbox.md)                                  | 5    | Ready       |                    |
| [183 Submit an inquiry from the contact page](183-holita-storefront-contact-form.md)                     | 5    | Ready       | 126, 182           |
| [195 Edit shopper profile details](195-holita-shopper-profile.md)                                        | 5    | Ready       |                    |
| [196 Change a shopper password](196-holita-shopper-password.md)                                          | 5    | Ready       |                    |
| [194 Configure customer fields and record values](194-holita-customer-fields.md)                         | 5    | Ready       |                    |
| [216 Expose enabled customer fields in shopper profiles](216-holita-shopper-custom-fields.md)            | 5    | Ready       | 194, 195           |
| [218 Limit promotion redemptions per customer](218-holita-discount-shopper-cap.md)                       | 5    | Ready       |                    |
| [210 Capture transactional order email in a local mailbox](210-holita-transactional-email-outbox.md)     | 5    | Ready       |                    |
| [211 Verify a shopper email change using local delivery](211-holita-shopper-email-change.md)             | 5    | Ready       | 210                |
| [212 Initiate a verified customer email correction](212-holita-admin-customer-email.md)                  | 5    | Ready       | 211                |
| [205 Issue ordinary standalone invoices](205-holita-standalone-invoices.md)                              | 5    | Ready       | 204                |
| [227 Edit SEO metadata for shop content](227-holita-content-seo-metadata.md)                             | 5    | Ready       | 123, 124, 226      |
| [228 Publish an origin-wide robots file and scoped shop sitemaps](228-holita-storefront-sitemap.md)      | 5    | Ready       | 123, 124           |
| [236 Edit SEO metadata for the shop and catalogue listings](236-holita-listing-seo-metadata.md)          | 5    | Ready       | 126, 226           |
| [224 Manage local newsletter subscriptions](224-holita-admin-newsletter-subscribers.md)                  | 5    | Ready       |                    |
| [225 Collect newsletter opt-ins in Basic](225-holita-storefront-newsletter.md)                           | 5    | Ready       | 224                |
| [181 Manage the signed-in operator profile](181-holita-operator-profile.md)                              | 5    | Ready       |                    |
| [237 Find merchants and maintain their account details](237-holita-backoffice-merchant-contact.md)       | 5    | Ready       | 155                |
| [238 Find and rename shops from Backoffice](238-holita-backoffice-shop-directory.md)                     | 5    | Ready       |                    |
| [244 Manage platform staff accounts in Backoffice](244-holita-backoffice-staff-accounts.md)              | 5    | Ready       |                    |
| [247 Manage demo records in Backoffice](247-holita-backoffice-demo-register.md)                          | 5    | Ready       |                    |
| [248 Manage private demo attachments](248-holita-backoffice-demo-attachments.md)                         | 5    | Ready       | 247                |
| [249 Inspect transactional notices and exercise local delivery](249-holita-backoffice-email-history.md)  | 5    | Ready       | 210                |
| [186 Create another shop from merchant Admin](186-holita-merchant-create-shop.md)                        | 5    | Needs owner |                    |
| [187 Configure a shop's base currency](187-holita-shop-base-currency.md)                                 | 5    | Needs owner |                    |
| [190 Verify a storefront alias for the selected shop](190-holita-shop-domain-aliases.md)                 | 5    | Needs owner |                    |
| [253 Route verified storefront hosts to their Branch](253-holita-storefront-alias-routing.md)            | 5    | Blocked     | 190                |
| [191 Define merchant self-registration and approval](191-holita-merchant-signup-approval.md)             | 5    | Needs owner |                    |
| [209 Record approved VAT values on orders and invoice snapshots](209-holita-invoice-vat-snapshots.md)    | 5    | Needs owner |                    |
| [255 Render stored invoice VAT in downloaded documents](255-holita-invoice-vat-rendering.md)             | 5    | Blocked     | 206, 209           |
| [217 Define how standalone invoices are corrected](217-holita-standalone-invoice-corrections.md)         | 5    | Needs owner | 205                |
| [254 Define and issue standalone pro formas](254-holita-standalone-pro-formas.md)                        | 5    | Needs owner | 205                |
| [213 Support an authorized shopper session from Admin](213-holita-merchant-customer-support.md)          | 5    | Needs owner |                    |
| [214 Define supported removal of a shop customer](214-holita-customer-removal.md)                        | 5    | Needs owner |                    |
| [240 Remove a merchant with no shops](240-holita-backoffice-merchant-delete.md)                          | 5    | Needs owner | 237                |
| [241 Approve the shop retirement and purge contract](241-holita-backoffice-shop-purge-policy.md)         | 5    | Needs owner |                    |
| [242 Apply approved Commerce cleanup to a retired shop](242-holita-commerce-retired-shop-cleanup.md)     | 5    | Blocked     | 241                |
| [243 Run approved shop retirement from Backoffice](243-holita-backoffice-shop-retirement.md)             | 5    | Blocked     | 238, 242           |
| [245 Recover a selected operator account](245-holita-backoffice-account-recovery.md)                     | 5    | Needs owner | 237, 244           |
| [246 Open the selected shop in a staff support session](246-holita-backoffice-shop-support.md)           | 5    | Needs owner | 238                |

## Deferred follow-ups

These stay outside the runnable wave until their blockers are resolved. The scope excludes proposed Basic digital-file and review screens, a new redirect workflow, shipping zone and subtotal editors, and automatic gift-card settlement.

| Ticket                                                                                                      | Wave | Status  | Depends on |
| ----------------------------------------------------------------------------------------------------------- | ---- | ------- | ---------- |
| [174 Organize shared Basic images into folders](174-holita-shop-shared-media.md)                            | 5    | Blocked | 188        |
| [177 Attach a private versioned digital file through the catalogue API](177-holita-variant-digital-file.md) | 5    | Blocked |            |
| [178 Pin earned digital downloads to a private file version](178-holita-shopper-digital-download.md)        | 5    | Blocked | 177        |
| [229 Scope parity for shop redirect rule APIs](229-holita-storefront-redirects.md)                          | 5    | Blocked |            |
| [230 Moderate product reviews from an approved source](230-holita-admin-review-moderation.md)               | 5    | Blocked |            |
| [233 Issue shop gift cards for an approved use](233-holita-admin-gift-cards.md)                             | 5    | Blocked |            |
