# Local development

## Prerequisites and installation

Use the repository on the Ubuntu/WSL filesystem with Node.js 24.15+ and npm 11; the pinned
package manager is npm 11.19.0. With nvm available:

```bash
cd /var/workspace/services/holita
nvm use
npm ci
```

If Node 24 is not installed, run `nvm install` first. nvm is loaded by the shell; a bare
non-interactive WSL process may not have node/npm on PATH. Use a WSL terminal. For the default
nvm installation, initialize a non-interactive shell with `. "$HOME/.nvm/nvm.sh"` before
`nvm use`. Native Windows execution is not part of the verified setup.

## Commands

| Command                                           | Behavior                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| npm run dev                                       | Wait for PostgreSQL in Docker, then start four backends and both Angular modes                      |
| npm run dev:admin                                 | Angular real Stores/Products/Venues/Speakers/Tags/Vehicles/Events on port 11000                     |
| npm run dev:admin:mock                            | Angular Prototype CRUD, Events/Sessions/Gallery/History on port 11001; no backend needed            |
| npm run dev:gateway                               | Nest gateway watcher                                                                                |
| npm run dev:core                                  | Nest core watcher                                                                                   |
| npm run dev:products                              | Nest products watcher                                                                               |
| npm run dev:reference                             | Nest Reference watcher                                                                              |
| npm run projects                                  | List Nx application names                                                                           |
| npm run lint                                      | Lint source and root tooling, including application boundaries                                      |
| npm run typecheck                                 | Typecheck all five applications through Nx                                                          |
| npm run build                                     | Build all five applications through Nx                                                              |
| npm run format:check                              | Check formatting without rewriting files                                                            |
| npm run check:affected -- --base=BASE --head=HEAD | Lint/typecheck root tools; lint, typecheck and build affected projects using real commit references |

`dev:admin` and its `dev:admin:graphql` alias start Angular. `test:admin` selects Angular
unit tests; `test:smoke:admin` (also `test:smoke`) selects its real-browser foundation checks.
`dev:admin:mock` starts Angular Prototype. Real and Prototype use separate origins and browser data.

`dev` runs `db:up` before starting the application group. Docker must be running; a failed
PostgreSQL startup prevents the applications from starting. Database setup, migrations and
seeds remain explicit commands. Ctrl+C stops the Node group; use `npm run db:down` to stop
PostgreSQL separately while preserving its volume.

Backend builds produce apps/NAME/dist. After building, use
`npm run start:prod --workspace @holita/core` (or gateway/products/reference) to run the emitted Node
entry point.

The [CI workflows](testing.md#github-actions) use the same commands on Ubuntu with Node
from .nvmrc and npm from package.json's packageManager field. PostgreSQL stays in Compose;
Node checks and test application processes run on the runner host. CI does not deploy.

## Ports and environment

| Application             | Default         |
| ----------------------- | --------------- |
| admin (Angular Real)    | 127.0.0.1:11000 |
| admin Angular Prototype | 127.0.0.1:11001 |
| gateway                 | 127.0.0.1:11010 |
| core                    | 127.0.0.1:11011 |
| products                | 127.0.0.1:11012 |
| reference               | 127.0.0.1:11013 |

Ports 11000–11009 are reserved for visual applications and previews; the optional Sakai
preview uses 11002. Backends start at 11010 in the order gateway, core, products, reference.
PostgreSQL remains on 11084.

Backend `.env.example` files document PORT. Copy only the example you need to that
application's `.env`; defaults work without any environment file. Core/products/reference examples
also describe service-specific database URLs. Each backend starts
with its workspace as the current directory and reads that local environment file.
PORT must be an integer from 1 to 65535. An existing process environment takes precedence.

To override one backend without creating a file:

```bash
PORT=12011 npm run dev:core
```

## Angular admin foundation

After database setup/migration/seed, `npm run dev` starts the complete local group. Open
http://127.0.0.1:11000, choose a store and open its Products list. Angular uses the real
Gateway in Real mode. `npm run dev:admin:mock` starts Angular Prototype on port 11001,
with Angular-owned MSW handlers and browser fixtures. The mode is selected once at startup.
Sakai is the Angular admin's theme and visual reference, including feature screens.
Its [pinned local source](#sakai-source-reference) supplies layout, spacing and composition;
Concrete Angular features supply contracts, validation and scoped request lifecycles.

To run Angular alone with the backends already running:

```bash
npm run dev:admin
```

The CLI generates feature-local GraphQL documents before startup. After editing an operation,
run `npm run codegen` and `npm run schema:check`. GraphQL types are ignored generated output,
not handwritten API models. Development defaults to `/bg`; `/en` selects English.
`/bg/stores/:storeId/products` and its English equivalent retain the selected store on reload.
The PrimeNG/Sakai shell supplies Stores/Products/enabled Reference navigation, a store selector, Bulgarian/English
switching and light/dark themes. Desktop controls group the data mode, store selector, language and theme
on the right of the top bar. Desktop navigation can collapse; its hidden links are removed
from keyboard navigation. Mobile navigation opens a
modal Drawer. Below 992px, the mode indicator and store selector occupy a second 56px header row;
Sakai's 28px gutters and card padding remain. Keyboard order follows the visible controls,
and resizing across the breakpoint preserves the selected store and editor drafts.
Theme preference is stored as `holita.admin.theme`; denied browser storage shows
a status message. Loading/errors/empty data, unavailable stores and manual retry remain available.
The main content ends with Sakai's subtle divider and a centered holita footer.

Products uses server pagination (20 rows by default; sizes 10/20/50/100). Search matches name
or SKU; the separate SKU substring and status filters combine with it. Text applies after
300 ms; status and sorting apply immediately, including pending text. Name/SKU/Status headers
toggle ascending/descending; **Reset sorting** restores newest-first. Filter/sort/size changes
return to page one. **Clear filters** clears search, SKU and status while preserving sorting
and size. Back/Forward restores URL drafts and cancels pending text. Changing pages also
discards uncommitted text. The committed query uses `page`, `pageSize`, `search`, `sku`,
`status`, `sort` and `order`; unrelated query parameters and the fragment are preserved.
Invalid values normalize with history replacement. A requested page is retained until the
server supplies a total, then an unavailable page moves to the last available one.
Changing the query clears obsolete rows and disposes its read; refresh errors preserve rows
from the same query. Paginator controls and reports use the selected language.

**Create product** opens `/products/new`; product-name links open `/products/:productId/edit`
under the selected store/language. Typed Reactive Forms edit name, SKU and status, defaulting
new Products to Draft. Validation trims name/SKU, counts Unicode code points (200/100) and
rejects NUL. Invalid submission focuses the first invalid text field. Details errors expose
retry/back navigation without an empty edit form; malformed IDs do not start detail reads.
SKU conflicts and transport failures preserve entered values and show the request ID.
Submission disables the form and suppresses duplicate writes; success returns to the list with
its query/hash preserved, a fresh read and a success message.

A `CanDeactivate` guard confirms unsaved changes before leaving for another store, language,
create/edit mode or Product ID, including browser history. Rejecting a store change restores
the selector to the actual route. Dirty, unsubmitted forms also register `beforeunload` for
browser reload/closing; browser prompt availability and wording follow browser policy.
Submitted writes can settle after navigation. Their client/store/language stay captured;
completion cannot navigate, notify or change the next editor. Each editor initializes its
form once, so later detail notifications cannot overwrite local edits.
Products, lookup, Event and Session editors preserve rejected-write messages through
background reads. Editing or a new submission clears the write error. Read failures offer
**Retry** before and after initial loading; retrying the read preserves the current draft.

Each row provides **Delete**, and the checkboxes select records on the current page only.
The header checkbox selects that page, not every matching server record. Page/filter/sort/size
changes clear selection; refreshing prunes it to records still present on the page.
**Delete selected** confirms the selected count; single deletion names the product. Deletion
is permanent. Cancel has initial focus; Cancel/Escape restores the initiating button, while
confirmation moves focus to the Products heading.

Confirmed deletes run sequentially through the existing `deleteProduct` operation. Successful
deletions stay deleted; failures show the record name and diagnostic request ID, with only
failed rows retained for retry if they remain on the refreshed page. The summary reports both
counts. This is not an atomic batch operation. Selection/deletion and manual refresh are
disabled while it runs. One final read supplies fresh totals and corrects an emptied last page,
preserving the list URL/query/hash and completed summary. A failed refresh leaves confirmed
deletions removed and provides Retry. Changing store/language/editor or the list query stops
unsent deletes; the submitted write still settles against its captured client, without updating
the new view. Products use plain text fields; Angular Event descriptions support rich text.
Products have no image controls. Saved Reference Events provide the [Angular Gallery](#angular-reference-gallery).

### Angular Prototype

```bash
npm run dev:admin:mock
```

Open http://127.0.0.1:11001/bg (or `/en`). No backend or database is required.
The startup configuration selects `graphql` or `mock` once; omission defaults to Real.
The CLI's `prototype` configuration forces `mock` through a standard environment file
replacement. Served production builds may select it with public `dataSource: "mock"` in
`config.json`. The existing config/license loading path remains unchanged. Prototype forces
`/__prototype/graphql` at its own origin and enables the implemented Reference resources even when
Real's `referenceEnabled` is false. Changing the URL or store cannot switch transport.
MSW starts before Angular bootstrap and rejects unsupported, altered or foreign operation
documents and requests to the real Gateway. Prototype accepts POST with the exact generated
documents; other HTTP methods are rejected. The 47 generated Angular operations for Stores, Products, Venues, Speakers, Tags, Vehicles, Events,
Sessions, Gallery and History are supported. Their existing components and concrete Apollo
services work in both modes. The lazy [UI catalog](#ui-catalog) supplies local Sakai examples in Prototype.

Data is a small versioned localStorage snapshot under `holita.admin.prototype.data`. A new browser/host/port starts independent fixtures. Invalid or obsolete
snapshots are discarded; snapshot version 3 adds Vehicles and upgrades valid version 2 data in place.
Demo data is disposable and is never imported into Real. Lookup
uniqueness, literal search, filtering/pagination/sorting, nullable updates and store identity
follow the same contracts. Active/trashed Events and their Sessions reserve lookup rows for
deletion. Event validation preserves exact EUR strings, Sofia instants, paired registration
dates, sanitized descriptions and retained inactive relations. Lifecycle actions validate the
whole selection before one atomic snapshot write. Session ordering requires the complete
current ID set. Each mutation and its History entries share the same write; failed writes
leave both unchanged. Labels resolve from current lookup rows. No cross-tab coordination
or backend persistence parity is claimed.
Storage startup/write errors are reported, and rejected writes leave the previous snapshot intact.
If IndexedDB or the worker cannot start, bootstrap stops with localized storage/worker guidance.
Startup failures use an alert role and set the document's Bulgarian/English language before
Angular mounts, so assistive technology can announce the message correctly.

Gallery follows intent → binary → finalize on the same origin. Unfinished files stay in memory;
finalized Blobs use the native IndexedDB database `holita.admin.prototype.media`, object store
`images`, separately from metadata/History in localStorage. Files are written before metadata;
finalization re-reads the snapshot after the asynchronous byte write and rechecks the captured
Event and upload identity. Reset or Trash during that write cannot add media/History. Logical
removal precedes physical cleanup; startup and Reset prune orphan bytes. Trash/Restore retain
files. Local fixture images are served from `public/images/prototype`, without remote requests.
Only capability headers reach the direct upload. Expired or foreign capabilities and repeated
binary transfers fail; finalization is idempotent.
Read links are checked again after asynchronous file reads. Validation checks JPEG/PNG/WebP
signatures, truncation, animation markers, native decoding, 5 MiB and 20 megapixel limits. It
has no cross-tab coordination or Sharp decoder parity and does not simulate server disk/CORS
or the real service's persistence. Browser data never enters Real.

The shell displays the localized mode and browser hint. **Reset demo data** requires confirmation,
blocks new writes, waits for submitted mutations from active and retired clients, replaces
fixtures for both stores, then boots discovery in the current locale with fresh clients/forms.
A failed Reset retains the form and allows retry. Appearance preference remains separate.
The worker script is generated with MSW and served from the admin's public assets. Use a
loopback or HTTPS origin with browser storage and service workers enabled. For a custom port,
use `npm run dev:mock --workspace @holita/admin -- --port 12001`.
See [Angular checks](testing.md#angular-admin-checks) for backend-free compiled browser tests.

### Angular Reference Venues

For a selected store, **Reference → Venues** opens `/reference/venues`. The list uses server
pagination and URL parameters `page`, `pageSize`, `search`, `active`, `sort` and `order`.
Name search applies after 300 ms; activity and sorting also commit pending text. `active=false`
selects inactive records. Name/city/country/capacity/activity headers toggle ascending/descending;
**Reset sorting** restores newest-first. Capacity nulls remain last in both directions, with
descending ID ties. Filter/sort/size changes return to page one; Clear filters preserves size
and sort. History restores the applied filters; unrelated parameters/hash remain intact.

**Create venue** opens `/reference/venues/new`; names open `/:venueId/edit`. The form contains
name (required, 200 code points), description (optional, 2000), city (required, 120), two-letter
Latin country code, address (optional, 300), nullable positive integer capacity (up to 2147483647)
and activity (defaults to true). Text is trimmed, country code uppercased, NUL rejected and
optional blank description/address mapped to null; clearing capacity also sends null.
First-invalid-field focus, allowlisted server field errors and request IDs keep a rejected draft
usable. Initial detail errors support retry without exposing an empty edit form.

The Sakai editor uses a sticky desktop settings/action aside, following the details on mobile.
Dirty forms guard store/language/editor/history navigation and beforeunload. Submitted writes
retain their captured store/language/client and cannot navigate or alter the next editor.
Switching stores preserves Venues and opens its clean list. Single and page-local sequential
Delete require confirmation, preserve successes, report referenced-row failures and retain
failed selection for retry. An emptied last page is corrected from the server total. Navigation
stops unsent deletes; submitted writes settle against their original scope.

Angular Real uses the existing Reference service; Prototype supplies the same implemented
workflows locally. Rich text/media are not part of the Venue editor.

### Angular Reference Speakers, Tags and Vehicles

**Reference → Vehicles** opens `/reference/vehicles`; Create uses `/new` and a License
Plate link opens `/:recordId/edit`. The editor contains exactly two business fields:
required License Plate (1–32 Unicode code points) and optional Notes (a plain-text textarea,
up to 2000 code points). Both are trimmed; empty Notes saves as null and can be cleared.
Plates retain their entered case and support different countries' formats; duplicates are
allowed. The list has URL-backed plate search, plate sorting, server paging and confirmed
single/page-local sequential deletion, with partial failures and retry. Notes previews retain
line breaks and display up to three lines; the editor shows the full text. Real uses the
Reference database through Gateway; Prototype persists Vehicles with the same operations.
Version 2 Prototype snapshots upgrade to version 3 with an empty Vehicles collection while
preserving their existing records and media. Reference availability and discovered-store
checks apply to every Vehicles route.

**Reference → Speakers** opens `/reference/speakers`; **Reference → Tags** opens
`/reference/tags`. Create uses `/new`; clicking a name opens `/:recordId/edit`. Both lists
reuse the Venue query conventions, page sizes, 300ms name search, activity filter, newest-first
reset and preserved URL history. Speakers additionally sort by Email, with nulls last in both
directions; Tags sort by Color. The service breaks ties by descending ID.

Speaker Name is required (200 Unicode code points); Email is optional (254), with address
validation, and Short biography is optional (2000). Blank Email/biography updates explicitly
send null. Tag Name is required (100); Color accepts exactly `#` followed by six HEX digits.
A valid draft has a live swatch/value preview; submission trims and lowercases the color.
Both editors reject NUL, retain rejected drafts, focus known server field errors and preserve
false activity. Duplicate Tag names in the same store produce a Name field error.

Sakai list/editor styles are shared presentation files; each resource retains concrete
operations, API, list state, typed form and validation. Store switching preserves the current
Reference section and opens its clean list. Dirty forms guard route/store/language/history
navigation. Submitted writes and late callbacks follow the captured-client lifecycle described
for Venues. Page-local sequential deletion retains failed selection for retry; Speakers linked
through Sessions and Tags linked through Events cannot be deleted, including links retained
while an Event is trashed. The Angular UI reports these errors; Event Venue/Tag relations can be edited in Angular.

[public/config.json](../apps/admin/public/config.json) is fetched before Angular bootstraps,
with a 10-second deadline, so PrimeNG and Apollo receive their startup configuration.
Its `graphqlUrl` accepts a root-relative path or an HTTP/HTTPS URL without credentials or a
fragment. Configuration load/validation errors stop startup with a localized alert and matching document language.
Optional `primeUiLicense` supplies the browser-visible PrimeUI Community/commercial key to
PrimeNG's own verifier. An omitted/empty key leaves PrimeNG's standard license warning/banner
active; no application bypass is used. Keep issued keys out of commits. Supply the field only
in the local/served configuration, and restore the tracked example before committing:

```json
{ "graphqlUrl": "/graphql", "primeUiLicense": "your-issued-key" }
```

The default `/graphql` is proxied to http://127.0.0.1:11010 by
[proxy.conf.json](../apps/admin/proxy.conf.json). This same-origin proxy lets Angular use the
existing gateway CORS configuration. A custom gateway port requires a matching proxy target.
Use Angular CLI's native options for a custom port/proxy:

```bash
npm run dev --workspace @holita/admin -- --port 12000 --proxy-config /absolute/path/proxy.conf.json
```

A production build is `apps/admin/dist/browser`. Serve it with SPA fallback to `index.html`
and an origin-local `/graphql` reverse proxy, or supply an absolute gateway URL in the public
config and align `ADMIN_ORIGIN` with the browser origin. This JSON is public configuration;
credentials belong neither there nor in frontend source. No deployment is configured.

Use [Angular checks](testing.md#angular-admin-checks) to verify real routing, generated
contracts, per-workspace cache isolation and pending mutations. Store selection scopes data;
it provides no authorization.

### Angular Reference Events

**Reference → Events** opens `/reference/events`; Create uses `/new`, a Title link opens
`/:recordId/edit`, and View opens `/:recordId`. Saving creation opens its new editor; saving
an edit opens the overview. These routes preserve list query/hash and Bulgarian/English.
Store switching returns to that store's clean Events list.

The list stores `search`, `status`, `format`, `venues`, `tags`, `featured`, `from`, `to`, `min`,
`max`, `sort`, `order`, `page`, `pageSize` and `view=trash` in the URL. Enum/ID selections use comma-separated
values. Search and Status are visible; **More filters** expands Format, Featured, relations and
ranges. Search matches Title/Code after 300 ms; other changes apply immediately. Start dates
include the complete final calendar day in Europe/Sofia, including 23/25-hour DST days.
Invalid date/capacity range drafts show a warning and retain the previous applied query.
Back/Forward restores filters. Starts at ascending is the default; Title, Status, Capacity,
Budget and Created at also sort on the server. Column choices persist per store under
`holita.events.columns.v1.<storeId>`; Reset restores default columns, filters, sort and paging while preserving Active/Trash.
Storage failures remain visible without preventing table use.

The typed editor uses Sakai cards, PrimeNG Accordion sections and a sticky desktop settings
aside, below the form on mobile. Desktop field groups use the available content width to choose
one or two columns; Accordion sections share the card's horizontal padding. Saved overview
titles, Tag labels and Session editor breadcrumbs wrap long words within the page. General owns Title (200 code points), immutable Code (100),
Format, positive nullable Capacity and exact decimal-string Budget EUR (0–9999999999.99,
up to two decimals). Status and Featured are editable settings. Schedule owns starts/ends,
paired registration calendar dates, Venue and Meeting URL. In person requires a Venue;
Online requires an absolute HTTP/HTTPS Meeting URL; Hybrid requires both. Format changes
clear inapplicable relations/URL on submission. Blank optional values send null; Tags clear
with an empty ID list, and false Featured remains false.

Minute inputs preserve untouched stored seconds/milliseconds and either repeated autumn
offset. Changed inputs use date-specific Sofia offsets; nonexistent spring times are rejected.
End follows Start; registration closes on/after opening and by the Sofia Event start date.
List/overview date labels use Bulgarian or British English formatting; overview times also
show the Sofia UTC offset. Registration dates keep their calendar day.
Relation dialogs search on the server after 250 ms, page by 20 and hydrate selected IDs.
Existing inactive choices remain labeled; new form assignments require active rows. List
relation filters may include inactive rows. Remote reads cancel on replacement/closing;
closing also cancels pending search debounce, so reopening cannot reset a newly selected
page. Errors offer retry, and paging retains popup search focus.

Content contains Tags, plain Summary (500 code points) and rich Description. Tiptap core and
StarterKit supply paragraphs, H2/H3, bold/italic, ordered/bullet lists, line breaks, links,
undo and redo. Angular uses the core editor through a typed ControlValueAccessor. DOMPurify removes unsupported pasted/stored HTML; links require
absolute HTTP/HTTPS without credentials. The backend independently sanitizes writes.
The description limit is 100 KiB UTF-8 HTML; empty content clears to null. Submission disables
both form and rich editor. The overview renders sanitized saved HTML and current relation
labels. Speaker biographies remain plain text.

Dirty navigation and first-invalid/server-field focus retain rejected drafts and open the
owning section. Retired clients allow submitted writes to settle, while late results cannot
navigate or update another store/language/editor.

**Active events / Trash** switches the server list and resets its page. Checkboxes select only
visible rows, at most 100; page/filter/sort/size/view changes clear the selection. Same-query
refresh prunes it to rows still present. **Publish selected**, **Archive selected**, **Trash
selected** and **Restore selected** confirm the count and submit one atomic backend mutation.
Foreign, missing or ineligible IDs reject the whole action. Failure keeps the dialog, error and
selection for retry; Cancel/Escape are available again after failure. Submitted actions disable
duplicate confirmation and cancellation. Query/store/route navigation retires the old dialog
and completion callbacks, while its write settles against its captured client. Successful
completion clears selection and refreshes server totals, correcting an emptied last page.

The overview offers confirmed Publish/Archive and Trash for active Events, and Restore for
Trash. Trash is read-only, retaining status, reserved Code, Sessions, Gallery and lookup links;
its editor and child reads remain blocked by the backend. Restoration retains that data.
**History** (`tab=history`) is available for active and trashed Events, with server pages of 20,
localized operation/field labels and Anonymous actor, Sofia times including the UTC offset,
and expandable before/after values. Description HTML appears as sanitized plain-text excerpts.
Seed Events have no invented History. New actions refresh the current overview and History;
errors expose Retry and request IDs. Back to events removes the History tab parameter while
preserving the list query/hash. Active Events also provide the [saved Gallery](#angular-reference-gallery).

Optional public startup `referenceEnabled` must be a boolean and defaults to true. Set false
in the served configuration when Reference is unavailable: its navigation is hidden and
list/create/edit/overview routes show a localized unavailable message without business requests.
Products remains operational. The backend's `REFERENCE_ENABLED` is configured separately;
backend errors use the usual diagnostics/retry path. The frontend flag is not authorization.

### Angular Reference Sessions

Open an active Event overview and select **Sessions** (`tab=sessions`). The complete
program has at most 100 Sessions. **Add session** opens `/:eventId/sessions/new`; a row's
**Edit session** opens `/:eventId/sessions/:sessionId/edit`. Links retain the Event list
query and fragment; save and cancel return to the same Event's Sessions tab. The standalone
editor saves independently from Event details and confirms discarding dirty unsubmitted input.

Title is required (200 Unicode characters). Optional plain Summary (2,000) and Room (120)
trim on save and clear explicitly to null. Start defaults to the saved Event start; end is
required and must follow start. Both use Europe/Sofia, reject invalid dates/spring gaps and
must lie within the saved Event. Unchanged minute controls preserve stored seconds,
milliseconds and either repeated autumn offset. Overlaps between Sessions are permitted;
the server rejects Event date changes that would exclude any existing Session.

The remote **Speakers** dialog searches/pages active records and separately hydrates selected
IDs. Keep at most 100 distinct assignments. Existing inactive Speakers are labeled and may
be retained or removed; they cannot become new assignments. The overview displays each
Speaker once across the current program, with inactive labels and read-error retry.

Drag a row's handle or use its named up/down buttons to create a local ordering draft.
Changes announce the new position. **Save order** submits the complete ID permutation
atomically; errors retain the draft. A membership conflict requires **Cancel order**, which
reads the current server order before clearing the draft. Failed reloads retain it. Add/edit/
delete and Event actions are disabled while ordering is dirty. Tab, parent/store/language
navigation and browser unload guard unsaved order; submitted writes settle in their captured
client without blocking navigation or affecting a new workspace.

Session deletion is permanent and confirmed separately. Errors keep the target available for
retry; Cancel/Escape returns focus to its trigger and success focuses the program heading.
Create/edit/delete/order changes update the saved program and initiating Event/History.
Event Trash disables Sessions and blocks direct child reads/editors; Restore returns the
retained program. These controls use the real API or the matching Angular Prototype operations.

### Angular Reference Gallery

A saved active Event's editor shows **Content → Event gallery**. The overview's
Event tab shows the saved images with read-only previews. New Events must be saved first;
Trash mounts no Gallery or child reads, and Restore returns the retained images.

**Add image** uses the existing GraphQL intent → direct HTTP transfer → GraphQL finalization
contract. Binary bytes go directly to Reference with the captured upload URL/headers. Progress
and **Cancel upload** cover the intent/transfer stages; navigation cancels unfinished transfer.
Once finalization starts it settles against the initiating store/Event even after navigation,
without notifying or changing a new editor. Failed or cancelled uploads can be retried.
Cancellation leaves the server reservation to its existing expiry: ten minutes before completed
transfer, or one hour after transfer without finalization.

The Gallery accepts nonempty JPEG, PNG or WebP still images of at most 5 MiB, valid filenames
of up to 255 Unicode characters and at most 10 images, including pending reservations. Reference's decoder validates
actual format, still-image rules and the 20 megapixel limit. Browser validation does not replace
server validation. Configure Reference's [upload origin allowlist](#reference-media-configuration) when serving
Angular from another origin.

Upload, **Set cover**, **Alt text** and **Remove** save independently of Event fields, retaining
unsaved Summary/Description and other text. Alt text is trimmed, limited to 300 Unicode
characters without NUL, and blank input clears it to null. Removal is permanent and confirmed;
removing the cover selects the first remaining image. Failed operations preserve their target
and draft for retry. Cancel/Escape returns focus to the initiating control.

Drag a card's named handle or use its earlier/later buttons to create an ordering draft.
**Save image order** submits the complete distinct ID set atomically; failure retains the draft.
**Cancel image order** reloads current server membership before clearing it. Dirty ordering and
Alt text guard route/store/language navigation and unload. Finish or cancel Gallery work before
**Save event**. Gallery activity does not submit or rehydrate Event fields.

Open an image for its full preview, then use **Previous image**, **Next image** or the arrow
keys. Escape closes it and restores focus. Metadata refreshes every eight minutes while mounted;
**Refresh images** renews broken/expired links, including after Reference restarts. Opening an
expired preview also refreshes it. See [media storage and capabilities](architecture/overview.md#event-media-and-direct-uploads)
and [focused checks](testing.md#angular-admin-checks).

### Sakai source reference

The Angular admin uses Sakai's 14px root scale, PrimeNG 22's
[`aura-compat` preset](https://primeng.dev/theming/styled#base-font-size) and Lato.
The compatibility preset preserves control typography and spacing at a 14px root.
[The preset composition](../apps/admin/src/app/layout/sakai-preset.ts) imports the original
Aura base and only the component presets used by the admin, including PrimeNG's internal
dependencies. When introducing another PrimeNG control, include its preset and any component
dependencies there; keep the original tokens and review both themes at the same viewport sizes.
Font weights 400, 500, 600, 700 and 800 are served from `apps/admin/public/fonts/lato`, including Cyrillic glyphs;
no external font CDN is required. Font sources and licenses are recorded in
[the admin attribution](../apps/admin/THIRD_PARTY_NOTICES.md).

Sakai is the Angular admin's theme and visual reference for shell and feature presentation,
including spacing, typography, geometry and responsive layout.
Concrete Angular features supply contracts, validation and request lifecycles.

The local Sakai Angular source is `.references/sakai-ng`, outside `apps/` and the npm
workspaces. Git, Nx, ESLint and Prettier ignore `.references/`. The checkout is a source
reference for the Angular admin's layout and visual comparisons; the application does
not import or load files from it, and normal installation/build/test commands do not
require it. No template dependencies are installed by the workspace.

The reference uses [PrimeTek's official repository](https://github.com/primefaces/sakai-ng)
at revision `96d71496d685b5c110efd2875abaa2bf89a56ad2`. Its `src/assets` submodule is
[sakai-assets](https://github.com/cetincakiroglu/sakai-assets) at
`eaa70ece4cfa9aeb8f60b36dce5a422b6bae8003`. To recreate the checkout from the repository root
when the destination does not exist:

```bash
git clone https://github.com/primefaces/sakai-ng.git .references/sakai-ng
git -C .references/sakai-ng checkout --detach 96d71496d685b5c110efd2875abaa2bf89a56ad2
git -C .references/sakai-ng submodule update --init --recursive
```

For an optional rendered comparison, install the reference's own locked dependencies
and run its existing preview script from that checkout:

```bash
cd .references/sakai-ng
nvm use
npm ci --no-audit --no-fund
npm start -- --host 127.0.0.1 --port 11002
```

Open `http://127.0.0.1:11002/pages/empty` for the shell,
`/pages/crud` for the template's CRUD presentation and `/uikit/formlayout` for forms.
Use another free port if needed. The reference has its own dependencies and cache;
it does not change holita's lockfile or join the workspace. Stop its preview after
the comparison. Temporary comparison captures belong in the ignored `.references/review/`.

Use `src/app/layout/component` for the original shell components, `src/app/layout/service`
for their presentation state, and `src/assets/layout` for layout SCSS. Compare the original
and holita at matching viewport sizes. The reference uses Angular/PrimeNG 21; holita uses
Angular/PrimeNG 22, so component APIs must follow the installed versions and current
official metadata. The upstream template contains demo routes and dependencies that are
not part of holita. The adapted files and their licenses are recorded in
[the admin attribution](../apps/admin/THIRD_PARTY_NOTICES.md).

### Angular agent tools

The repository includes the official
[Angular developer skill](../.agents/skills/angular-developer/SKILL.md) from
[angular/skills](https://github.com/angular/skills), revision
`eaf83d2c88fb5fa1449cf717792d32f1463dc1b9`. It is an unchanged upstream snapshot in
`.agents/skills/angular-developer`; Prettier excludes that directory. Update it deliberately
from the official source, keeping its referenced files together. Codex discovers repository
skills automatically; start a new turn, or restart Codex if the new skill does not appear.

[holita-admin-development](../.agents/skills/holita-admin-development/SKILL.md) adds only
Holita's application boundaries, generated contracts, lifecycle and check selection.

Install the official [PrimeNG plugin](https://primeng.dev/plugin) in the Codex user environment:

```bash
codex plugin marketplace add primefaces/primeui-plugins
codex plugin add primeng@primeui
codex plugin list --json
npx --yes @primeui/cli doctor --tool codex --library primeng --json
```

The plugin bundles seven focused skills and the read-only `@primeng/mcp` server. Its manifest
selects the PrimeNG 22 package range `>=22.0.0 <23.0.0`. Do not register that server again
through `codex mcp add` or project configuration. Start a new Codex session after installation
to load its tools; restart Codex if discovery has not refreshed. The plugin installation is
user-local, so another contributor must install it separately. No application dependency or
issued PrimeUI license key is needed to run the documentation server.

Use the plugin's router to select the smallest relevant workflow and current MCP metadata
before writing component APIs. `doctor` verifies the installed payload, server startup,
eight-tool contract, documentation retrieval and valid/invalid API handling. Host skill/MCP
discovery may be reported as unsupported separately from those passing runtime checks;
verify tool availability in the new session. These checks do not replace application tests.

The root Prettier configuration selects the Angular parser for `apps/admin/src/**/*.html`,
including suffixless component templates. To format or check only these templates:

```bash
npm exec -- prettier --write 'apps/admin/src/**/*.html'
npm exec -- prettier --check 'apps/admin/src/**/*.html'
```

## Manual Prototype review

Run `npm run dev:admin:mock` and open http://127.0.0.1:11001/bg (or `/en`).
No backend or database is needed. Confirm the Prototype indicator, select each store and
exercise Products, Venues, Speakers, Tags and Vehicles CRUD. Reload to check browser persistence.
Create an Event, edit its description, add a Session/Speaker and reorder the program.
Upload an image, set cover/Alt text, reorder it and confirm that Trash/Restore retains
children and images. Check History and then confirm Reset demo data, which waits for
submitted writes and restores fixtures in the current locale. Review the UI catalog's
local examples separately from saved business records. See [Angular checks](testing.md#angular-admin-checks)
for automated workflows and the [Prototype limits](#angular-prototype).

## UI catalog

In Angular Prototype, choose a store, then **Prototype → UI catalog**. Open
`/<language>/stores/<storeId>/ui-catalog` on port 11001. Real hides the menu and rejects
this route before loading the examples or requesting a CRUD resource. The catalog loads
on demand and mounts only for a discovered store.

Its four tabs use Sakai composition and native PrimeNG components:

- **Body and actions:** typography, helper text, buttons, status tags, cards and expandable details.
- **Lists and menus:** twelve local examples with immediate text/status filters, sorting,
  paging, page-local selection, a row menu, view/create/edit dialogs and confirmed deletion.
- **Forms:** typed Reactive Forms with text/email/number/color/date/time, single/multiple
  selection, checkbox, radio, activity switch and readonly fields. Validation focuses the
  first invalid field. Saving/disabled previews block changes; failed-save previews retain
  entered values. The summary aside is sticky on desktop and follows the fields on mobile.
- **States and feedback:** content, loading skeleton/progress, empty, error/retry, disabled
  actions, retained rows after refresh failure and keyboard-accessible confirmations.

The selected tab is in `?tab=body|lists|forms|states` and survives reload or browser history.
Unknown tab values show Body. Example values, selection and edits belong to the current tab
and reset when leaving it, reloading, switching stores/languages or resetting demo data.
Store switching stays in the catalog and opens Body. Examples do not issue business GraphQL
operations or write browser storage; normal store discovery still runs in the surrounding
workspace. Their validation illustrates presentation and does not prove a feature's backend rules.

## Admin translations

The Angular admin uses `/bg/...` and `/en/...` routes, defaulting to Bulgarian.
Bundled [messages](../apps/admin/src/app/i18n/messages.ts),
[Bulgarian](../apps/admin/src/app/i18n/bg.json) and [English](../apps/admin/src/app/i18n/en.json)
catalogs supply shell, feature, validation, confirmation, startup and Prototype text.
Language navigation preserves the path/query/hash and uses the editor's dirty-state guard.
The document language follows the URL. Each Apollo/Media client captures its language;
requests send `Accept-Language` without changing a global header. Submitted writes retain
their original store/language and obsolete callbacks cannot affect a newly mounted editor.
Display formatting uses the selected locale; Event/Session/History times remain Europe/Sofia
and EUR API amounts remain exact decimal strings. Backend messages, record content and
saved History values are displayed as received. Prototype Reset preserves the locale/theme.

## Reference media configuration

Reference stores files privately at `apps/reference/.media` by default. Set
`REFERENCE_MEDIA_ROOT` to a private persistent absolute directory to move it. Back up that
directory together with the Reference database. `REFERENCE_PUBLIC_URL` must be the browser-
reachable http(s) base URL for Reference (default loopback at its PORT); set Reference's
`ADMIN_ORIGINS` to a comma-separated list of exact HTTP(S) admin origins for upload CORS.
It takes precedence over the legacy single `ADMIN_ORIGIN`. With neither configured, Reference
allows localhost and 127.0.0.1 on port 11000. Existing installations
that set only `ADMIN_ORIGIN` retain that single-origin behavior; set `ADMIN_ORIGINS` for the admin origins in use. `*`, credentials, paths, queries and trailing slashes are rejected at startup.
Keep local overrides in Reference's ignored `.env`; the Gateway still uses its own `ADMIN_ORIGIN`.
No AWS credentials or object storage service is required. Source code, Git, Nx and formatting exclude `.media/`. Storage cleanup
runs automatically at startup and every minute; it retries failed removals using persisted
keys. There is no separate worker to start. See the [upload contract](architecture/overview.md#event-media-and-direct-uploads).

## GraphQL and generation

| Command                                        | Behavior                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| npm run schema:compose                         | Generate gateway supergraph and public schema from local SDL               |
| npm run codegen                                | Compose/validate contracts and generate each application's types/artifacts |
| npm run schema:check                           | Validate composition and all named operations, without writing artifacts   |
| npm run test:schema -- contracts.unit.spec.mts | Test real contracts and negative composition/operation cases offline       |

These commands need installed Node dependencies, not Docker, running subgraphs, a cloud
account or a schema registry. GraphQL Codegen v6 operation output uses its standalone
operations plugin; backend schema types use the TypeScript plugin. All generated output
lives under each application's ignored src/generated/graphql directory. Nx generation
targets explicitly include shared SDL, operation and tooling inputs. Nest copies GraphQL
assets into dist, so built applications do not read their source directories.

Root lint/typecheck/build/test and app dev/start commands generate their prerequisites.
After changing SDL or a named operation, run `npm run codegen`, then restart the Node
group. Asset watching is not dynamic schema composition. Keep PORT overrides aligned with
CORE_GRAPHQL_URL and PRODUCTS_GRAPHQL_URL in gateway; products also uses CORE_GRAPHQL_URL
for creation validation. URLs default to core 11011 and products 11012 on loopback.
Gateway ADMIN_ORIGIN defaults to http://127.0.0.1:11000 for browser CORS; update it if moving
admin. x-store-id and x-request-id are allowed headers; x-request-id is exposed in responses.

Use the gateway at http://127.0.0.1:11010/graphql. For store discovery, no headers are needed:

```graphql
query ListStores {
  stores {
    id
    name
  }
}
```

For product operations set `x-store-id` to one returned UUID. The seeded Sofia store is
`10000000-0000-4000-8000-000000000001`; Plovdiv ends in `0002`. A read including its actual
federated store:

```graphql
query ProductsWithStores {
  products(offset: 0, limit: 20) {
    items {
      id
      name
      sku
      status
      store {
        id
        name
      }
    }
    total
    offset
    limit
  }
}
```

Write operations are createProduct(input), updateProduct(id, input) and deleteProduct(id).
Creation requires name/SKU and defaults to DRAFT. Update accepts name, SKU and status;
at least one nonnull field is required. Neither input accepts storeId. See the
[contract behavior](architecture/overview.md#graphql-contracts-and-context) for limits,
error codes, unknown-store semantics and the core dependency on creation/federated fields.
Execution errors may use HTTP 200 with an errors array. Preserve x-request-id when reporting
a failure. Store context is not authentication or authorization.

## PostgreSQL and Prisma

Use Docker with Compose. Only PostgreSQL runs in a container; migrations, seeds and tests
run on the host. Run these commands from the repository root:

```bash
npm run db:up
npm run db:setup
npm run db:migrate
npm run db:seed
```

`db:up` waits for PostgreSQL health. `db:setup` creates development databases and roles;
`db:test:setup` separately creates test databases and roles. Both may be repeated: they
preserve data/passwords, verify existing owners/role privileges, and revoke PUBLIC access
to these six databases. They connect as the local `holita_admin` provisioning role, which
application URLs never use. They do not silently repair incompatible existing roles.

| Service   | Development database/role | Test database/role    | Environment variables                               |
| --------- | ------------------------- | --------------------- | --------------------------------------------------- |
| core      | holita_core               | holita_core_test      | CORE_DATABASE_URL, CORE_TEST_DATABASE_URL           |
| products  | holita_products           | holita_products_test  | PRODUCTS_DATABASE_URL, PRODUCTS_TEST_DATABASE_URL   |
| reference | holita_reference          | holita_reference_test | REFERENCE_DATABASE_URL, REFERENCE_TEST_DATABASE_URL |

Every listed database is owned by its matching role. Roles cannot create databases or
roles, and cannot connect to the other service's databases or the corresponding dev/test
database. Test schemas are created within the owning test database.

Local URLs and example passwords are in [core's example](../apps/core/.env.example) and
[products' example](../apps/products/.env.example). The fixed instance is loopback port
11084 by default. [The root example](../.env.example) configures POSTGRES_PORT and
POSTGRES_PASSWORD for Compose/provisioning. If changing the port, also set the matching
application/test URLs. Provisioning accepts only the expected names on 127.0.0.1 at that
port. Existing environment variables take precedence over .env files. Setup reads root,
core, products and reference .env files; app/Prisma commands read only their own workspace .env.
No old core-api environment is loaded or migrated automatically.

The Compose project is `holita`, with the persistent named volume `holita_postgres_data`.
The PostgreSQL 18 image mounts it at /var/lib/postgresql. `npm run db:down` removes the
container/network while preserving data. `npm run db:up` reuses the volume. Changing an
example password or POSTGRES_PASSWORD does not change passwords in an existing volume;
restore the correct configuration or deliberately manage credentials yourself. Never
use volume deletion or migrate reset to repair setup.

Each application owns prisma/schema.prisma, prisma.config.ts and prisma/migrations.
`npm run db:migrate` runs Prisma migrate deploy, core, products, then reference. Applied SQL migrations
are checked in and must not be edited. No shadow database or reset is required.
`npm run db:validate` validates all three Prisma schemas; `npm run db:generate` generates all three
clients without a running database. Clients in src/generated/prisma are ignored by Git
and generated before root lint/typecheck/build/test, independent core/products/reference dev/start,
and seeds. Do not edit generated output.

To create a subsequent migration, edit the owning schema, use that workspace's Prisma
`migrate diff` to produce SQL from its current database to the schema, review and place
the SQL in a new timestamped migration directory, then deploy and run its focused DB
tests. Use the Prisma CLI's `--help` for the installed version. Do not apply schema
changes with db push in place of migration history.

Seeds run core before products and insert two stable stores (holita Sofia and holita Plovdiv),
then three products per store. IDs are fixed in each application's prisma/seed-data.ts.
`createMany` with skipDuplicates preserves existing IDs, edited rows and user-owned SKU
conflicts; repeated seeds insert only missing rows. A conflicting row means the matching
sample is skipped. Product fixtures repeat the two stable store IDs explicitly;
standalone product seeding assumes core was seeded first. There is no cross-database
foreign key or network call in this administrative seed command.

## Existing installations with legacy resource names

The product and resources use holita. `red.bg` is only the temporary service domain.
An installation created with the former `red-bg` Compose project needs an explicit data
transition: changing the project name alone attaches a different, empty volume.

Stop the old application's writers before the final backup. Keep the old PostgreSQL
volume and restricted logical backups for rollback. For each service, use PostgreSQL's
`pg_dump --format=custom --no-owner --no-privileges` and restore into its new database
with `pg_restore --no-owner --no-privileges --role=<new-owner> --exit-on-error`. Restore
only into a deliberately provisioned empty destination; never reset an existing database.

| Legacy database/role | Current database/role |
| -------------------- | --------------------- |
| red_core             | holita_core           |
| red_products         | holita_products       |
| red_core_test        | holita_core_test      |
| red_products_test    | holita_products_test  |

The provisioning role changes from red_admin to holita_admin. Preserve its password
and each service role's password/privileges; provision destination roles before restore.
Retain existing credentials in ignored root/application `.env` files, using the new role
and database names in connection URLs. Fresh-install example passwords do not replace
credentials in an existing installation. Backup files containing role credentials must
remain private and must never be committed or printed in diagnostics.

Before switching connections, compare every row, UUID, timestamp, database object,
constraint, owner, access privilege and `_prisma_migrations` record. Verify restored
credentials and service/test role isolation. Repeat migrate/seed and restart PostgreSQL
to confirm preservation. Existing store names and user edits remain unchanged; holita
fixture labels apply only when seeds insert missing stores. Historical local logs and
the original brief retain their original names.

## Dependency compatibility and advisory status

Dependency ownership follows the five active workspaces. Refine, MUI/Emotion, URQL,
the Tiptap React adapter and React lint/testing adapters are absent. Angular retains Tiptap
core/StarterKit, DOMPurify, dayjs, MSW and Vitest/jsdom; Vite remains a transitive Angular/
Vitest build dependency. React/react-dom and React types remain transitive dependencies of
Prisma Studio inside the backend Prisma CLI, rather than an admin application dependency.
Keep those tool-owned packages when pruning; `npm explain <package>` shows their owners.

The lockfile applies narrowly scoped overrides while the owning dependencies still
request vulnerable versions:

| Consumer                                                   | Override           | Purpose                                                   |
| ---------------------------------------------------------- | ------------------ | --------------------------------------------------------- |
| nx                                                         | smol-toml 1.9.0    | Patched 1.x TOML parsing                                  |
| @prisma/config                                             | deepmerge-ts 8.0.2 | Patched recursive merging; exercised by Prisma config/CLI |
| @apollo/federation-internals, @apollo/query-graphs, gaxios | uuid 11.1.1        | Patched version retaining CommonJS support                |

Review these overrides when updating their parent packages. Preserve the npm-generated
lockfile and validate generation, schemas, migrations/seeds and federation after changes.
Do not use `npm audit fix --force` as a substitute for compatibility testing.

Apollo Gateway's transitive OpenTelemetry 1.x tree still carries
[GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf).
The patched core begins at 2.8.0, but a core-only override removes APIs used by the 1.x
SDKs. Updating the whole family also removes Resource/Sync detector APIs used by Apollo;
see the [upstream 2.x migration guide](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md).

The current gateway disables Apollo anonymous metrics and configures no inbound baggage
propagator. Node's normal 16 KiB total HTTP-header limit bounds incoming requests, as
described in the advisory's workaround. Gateway bootstrap and real federation tests
verify rejection of an oversized baggage header before subgraph calls. This mitigates
the HTTP entry point; it does not patch the installed library or make the audit clean.
Raising header limits, enabling telemetry propagation, or adding a non-HTTP transport
requires reassessing this finding. The foundation is local development without auth;
this is not a production security acceptance.

## Troubleshooting

- Missing executable or dependency: initialize Node/npm and run `npm ci` from the root.
- Prototype shows Real or cannot discover stores through the gateway: restart with
  `npm run dev:admin:mock` and open http://127.0.0.1:11001. `dev:admin` starts Real;
  restart the process after changing its startup configuration.
- Prototype cannot start its worker or browser storage: use the loopback URL above and
  enable service workers, localStorage and IndexedDB for that site, then reload. Prototype
  requires a secure browser context and reports denied storage access on screen.
- Prototype edits appear missing after changing browser, host or port: browser data belongs
  to the exact origin. Return to the original browser/origin; Real has a separate dataset.
- Database connection refused: run `npm run db:up`; check port and service-specific URLs.
- Missing database/role: run `db:setup` for development or `db:test:setup` for tests.
- Missing table: run `db:migrate` for development. DB tests deploy into their own schemas.
- Missing/stale GraphQL artifact: run `npm run codegen` and restart the affected apps.
- SERVICE_UNAVAILABLE during creation: check core and products' CORE_GRAPHQL_URL. No product
  is inserted when existence validation fails. A query selecting Product.store also needs core.
- BAD_USER_INPUT for x-store-id: pass a store UUID as one header. Store listing needs no
  selected store. A valid unknown store has an empty product list; creation returns NOT_FOUND.
- Unexpected existing database owner, role privileges or password: inspect configuration;
  setup intentionally refuses to overwrite credentials/ownership or erase data.
- Busy port: stop the process you own or explicitly choose another port. Angular CLI reports the occupied admin port; Nest reports its listen error.
- Invalid PORT: correct the application .env/process environment and restart the process.
- No tests found: see [testing](testing.md); this is not a successful check.
- Missing affected base: use a real local commit or fetch the intended base yourself;
  do not assume origin/main exists. `--base=HEAD` compares local work against the current
  commit, including untracked source files, rather than an entire PR.
- After Ctrl+C, verify the task's ports are released before starting another copy.
