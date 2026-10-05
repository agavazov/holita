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
| npm run dev                                       | Start four backends plus both admin-react modes; Ctrl+C stops the group                              |
| npm run dev:admin-react                           | Real React admin (alias of dev:admin-react:graphql)                                                  |
| npm run dev:admin-react:graphql                   | Real React admin using the gateway                                                                  |
| npm run dev:admin-react:mock                      | Prototype React admin with browser fixtures; no backend needed                                      |
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

The compatibility commands `dev:admin`, `dev:admin:graphql`, `dev:admin:mock`, `test:admin`
and `test:smoke` currently delegate to admin-react. New scripts and documentation use the
explicit admin-react names to identify the React workspace unambiguously.

Backend builds produce apps/NAME/dist. After building, use
`npm run start:prod --workspace @holita/core` (or gateway/products/reference) to run the emitted Node
entry point. Admin uses `npm run preview --workspace @holita/admin-react` to preview its build.

The [CI workflows](testing.md#github-actions) use the same commands on Ubuntu with Node
from .nvmrc and npm from package.json's packageManager field. PostgreSQL stays in Compose;
Node checks and test application processes run on the runner host. CI does not deploy.

## Ports and environment

| Application           | Default         |
| --------------------- | --------------- |
| gateway               | 127.0.0.1:11080 |
| admin-react Real      | 127.0.0.1:11081 |
| admin-react Prototype | 127.0.0.1:11087 |
| core                  | 127.0.0.1:11082 |
| products              | 127.0.0.1:11083 |
| reference             | 127.0.0.1:11086 |

Backend `.env.example` files document PORT. Copy only the example you need to that
application's `.env`; defaults work without any environment file. Core/products/reference examples
also describe service-specific database URLs. Each backend starts
with its workspace as the current directory and reads that local environment file.
PORT must be an integer from 1 to 65535. An existing process environment takes precedence.

To override one backend without creating a file:

```bash
PORT=12082 npm run dev:core
```

For admin, Vite accepts an explicit port:

```bash
npm run dev --workspace @holita/admin-react -- --port 12081
```

`apps/admin-react/.env.example` documents VITE_GATEWAY_URL, defaulting to
http://127.0.0.1:11080/graphql. This is the admin's GraphQL business endpoint; direct image transfers use URLs returned by Reference. It is a public
browser configuration value, never a place for credentials. Vite reads it at startup/build.
Use `VITE_GATEWAY_URL=http://127.0.0.1:12080/graphql npm run dev:admin-react` for a gateway override,
and align gateway ADMIN_ORIGIN with the exact browser origin when moving the admin port.

## Admin data modes

The same admin runs as **Real** (`graphql`, port 11081) and **Prototype** (`mock`, port
11087). The top bar identifies the mode (below it on mobile). `npm run dev` starts both plus the four
backends; it still requires the explicit database setup for Real. Each admin has its own
origin and Refine cache. The mode is fixed for that process; navigation never changes it.

After [installation](#prerequisites-and-installation), run Prototype from the repository root
without PostgreSQL, Docker or any backend. No `.env` file is required:

```bash
npm run dev:admin-react:mock
```

Open http://127.0.0.1:11087. The mode indicator must say **Prototype**; choose **holita Sofia**
or **holita Plovdiv** to open that store's Tags list. The terminal stays open while the admin
runs; Ctrl+C stops it. Use the same browser and origin to keep your saved demo data.
For a visual walkthrough, follow [manual Prototype review](#manual-prototype-review).
For automated checks, follow [Prototype checks](testing.md#prototype-checks); they start their
own instance and do not require this development process.

To use another Prototype port:

```bash
VITE_DATA_SOURCE=mock npm run dev --workspace @holita/admin-react -- --port 12087
```

That instance opens at http://127.0.0.1:12087 and has a separate browser dataset.

Run Real alone with a prepared, running gateway:

```bash
npm run dev:admin-react:graphql
```

`dev:admin-react` remains an alias for Real. These root commands explicitly set `VITE_DATA_SOURCE`,
so a local `.env` cannot change their mode. Running the admin workspace directly accepts
`VITE_DATA_SOURCE=mock|graphql` from the environment or its Vite `.env`; omission defaults to
`graphql` and any other value fails startup. Default admin builds explicitly use `graphql`.
Each development mode has its own Vite dependency cache under the admin's node_modules.
Browser test fixtures use disposable per-run caches so they cannot replace dependencies
served by a running development instance.

For an optional Prototype build, generate the local contracts first, then build with Vite:

```bash
npm run codegen
VITE_DATA_SOURCE=mock npm exec --workspace @holita/admin-react -- vite build
```

This produces `apps/admin-react/dist` with disposable demo data and requires a secure context
(HTTPS or localhost) for the worker. Normal `npm run build` and the admin workspace's
`build` script explicitly produce Real, even if the caller sets `VITE_DATA_SOURCE=mock`.

Prototype supports **store discovery, Products/Venues/Speakers/Tags CRUD, Events and
Sessions, Gallery/uploads, Event History and the UI catalog**. Open http://127.0.0.1:11087, choose a store
to open Tags, then use Workspace or Reference navigation. Unknown sections show an
unavailable message before feature mounting. Real retains all its implemented modules.
Prototype ignores `VITE_GATEWAY_URL` and backend Reference disablement. Requests use
`/__prototype/graphql` on the Prototype origin; MSW starts before rendering, uses generated
operations and refuses unimplemented operations. Vite serves its worker from the installed
package, without a copied worker file.

Products and lookup resources have 24 fixtures in Sofia and 8 in Plovdiv, including
active/draft or inactive records and optional fields with and without values. Events have
22 active and 2 trashed fixtures in Sofia, 6 active and 2 trashed in Plovdiv, with three
sessions per event and initial creation/trash History. General, Schedule & location and
Content & media forms and Gallery use the same screens as Real. The first fixture Event in
each store has two locally served [Picsum](https://picsum.photos/) placeholders from
`apps/admin-react/public/images/tmp`, in WebP format at 1200 × 800 pixels; other and newly
created Events start empty.
Save a new Event before adding images.

Lists preserve filter/sort/page behavior. Writes enforce case-sensitive SKU/name/code
uniqueness within their store; Event codes remain reserved in Trash. Products search names
and SKUs, lookups search names, and Events search titles and codes. Nullable sorts keep
nulls last in both directions. Products/lookups break ties by descending ID; Events use
ascending ID. Nullable updates distinguish omission from explicit null. Email/UUID
validation uses the backend's validator package. Mock error shapes follow the owning service.

Event/Sessions use editable, store-scoped relations. New assignments require active
records; existing inactive assignments remain valid. Related labels resolve from current
lookup records. Venue/Tag deletion is refused while any Event references it, including
Trash; Speaker deletion is refused while any Session references it. Removing the actual
links releases those restrictions. Products and Sessions use permanent deletion. Event
Trash/Restore preserves status, relations, children and History. Bulk Event actions validate
the complete selection before saving. Session reorder requires the complete current program;
no-op edits/status/order do not add History. Sessions must fit within Event dates, and Event
date changes cannot exclude existing sessions. EUR amounts retain two decimal places and
registration dates use Europe/Sofia. Rich HTML uses the existing browser DOMPurify sanitizer,
with the supported tags/link rules and 100 KiB UTF-8 limits; DOM serialization may differ
from the server's sanitize-html output.

Saved Products, Venues, Speakers, Tags, Events, Sessions, media metadata and History share
`holita.prototype.data` in localStorage, using snapshot version 4. Older snapshots are
replaced by the complete initial dataset. Reload keeps edits; malformed snapshots,
including invalid cross-store relationships, restore fixtures. Each mutation and its
History entries are saved together. **Reset demo data** asks for confirmation, restores
both stores, clears Refine/form state and returns to store selection. It is unavailable
while a submitted mutation or Reset is pending; repeated confirmation cannot start another
Reset. Storage failures are visible, permit retry and leave the prior snapshot intact.
Appearance and list-column preferences are independent of demo data
and are not reset.

Uploaded image bytes use the native IndexedDB database `holita.prototype.media`, with an
`images` object store. Fixture images remain local static assets. Upload intents and unfinished
bytes stay in memory, with the same 10-minute upload and one-hour finalization deadlines as
Real; reload discards unfinished uploads. Only finalization persists a Blob, then saves its
metadata and History together. A failed binary write cannot add metadata; a failed snapshot
write removes the new Blob or leaves an inaccessible orphan for cleanup. Gallery list/read
URLs are temporary, origin-local capabilities, checked against the current store and active
Event. They provide no authentication. Each gallery response renews the ten-minute preview
lifetime; older links remain valid until their expiry. Cover assignment/removal updates
the parent Event timestamp, as in Real.

Removing an image saves its removal and History entry before deleting its bytes. Startup prunes bytes
without metadata, preserving uploads belonging to trashed Events. Reset discards unfinished
uploads, restores both stores and clears uploaded bytes. Physical cleanup failures leave
inaccessible bytes and retry on startup; Reset/removal still retain their saved logical result.
IndexedDB startup/read/write failures are visible. Clearing browser site data clears all demo
records and uploads. Prototype data is never transferred to Real.

Prototype checks MIME signatures, chunk/animation markers and native browser decoding,
including the 5 MiB and 20-megapixel limits. Browser decoder tolerance and error diagnostics
can differ from Real's strict Sharp validation. Prototype does not simulate server disk
permissions, multipart streaming, bandwidth or cross-tab transactions. Use one editing tab
per Prototype origin. Cancel and store/route changes abort the existing upload hook before
finalization; an already submitted finalization keeps its captured scope.

There is a short response delay to exercise loading and pending UI. This does not simulate
backend outages, transactions, concurrency locks or database text collation.

Demo data is small and disposable. Changing its structure requires a version bump and
fixture reset, rather than migrations. It belongs to this browser origin; changing the port,
clearing storage or using another browser starts a separate dataset. Multiple tabs do not
synchronize Refine caches, and simultaneous writes are not coordinated. Use one tab when
reviewing a workflow. This browser data is never transferred to Real.

### Manual Prototype review

Use http://127.0.0.1:11087 after starting Prototype. The following steps review the current
screens and browser persistence; they do not establish Real backend parity.

1. Confirm **Prototype** in the mode indicator, choose **holita Sofia**, then create a Tag
   with a unique name. Edit it, save and reload; the saved values should remain.
2. Switch to **holita Plovdiv**. The new Tag should be absent. Return to Sofia; it should
   still be present. The two stores have independent records.
3. Open **Prototype → UI catalog** and try all four tabs. Change filters, menus, forms and
   feedback states. Catalog examples reset when leaving their tab and must not change
   saved business records.
4. Open **Reference → Events**, use a row's **View** action, then check **Sessions** and
   **History**. Edit the Event's **Content & media** tab, upload two small JPEG/PNG/WebP images,
   change the cover and order and reload. Saved changes and finalized uploads should remain.
5. Review desktop collapse, light/dark appearance and a narrow viewport. On mobile, use
   **Open navigation**; the store selector and mode indicator should sit below the top bar.
   The layout has one navigation column, no footer and no horizontal page overflow.
6. When the test data can be discarded, choose **Reset demo data**, then **Reset data**.
   This removes saved changes, unsaved forms and uploads for both stores and returns to
   store selection. Fixtures return; theme and list-column preferences remain.

## UI catalog

In Prototype, choose a store, then **Prototype → UI catalog**. The route is
`/<language>/stores/<storeId>/ui-catalog`; Real hides the menu and blocks this route without mounting
the catalog or requesting a CRUD resource. The catalog loads on demand.

Its four tabs show the current Aurora/MUI presentation primitives and shared components:

- **Body & actions:** typography, paragraph and detail content, cards, activity lists,
  buttons, badges, tooltips, summary tables and expandable sections.
- **Lists & menus:** a local list with shared pagination, filters and row menus, sorting,
  page-local selection, example editing and confirmed deletion. Filters apply immediately.
- **Forms:** text/email/number/color/date inputs, dropdowns, multi-select, checkbox, radio,
  switch and readonly fields; required-field validation, first-error focus, state previews
  and the shared desktop/mobile form aside.
- **States & feedback:** initial loading, empty, error/retry, disabled content, preserved
  content after refresh failure, alerts, progress, confirmations and notifications.

The selected tab is in `?tab=body|lists|forms|states` and survives reload or browser history.
Example values, selection and edits belong to the current tab and reset when leaving it,
reloading, switching stores or resetting demo data. Store switching opens the default Body
tab. Examples do not issue business GraphQL operations or write browser storage. Their
filters and validation illustrate presentation; they do not prove a feature's backend rules.
See the [shared component inventory and usage rules](reference.md#ui-catalog-and-shared-components).

## Using Reference

Choose a store, then **Reference → Events, Venues, Speakers or Tags**. Each resource has a
paginated list and create/edit form using real persisted data. Page headers contain the
record context and applicable tabs. Supporting forms return to their list after saving;
creating an Event opens its edit URL, and later Event saves return to its overview. Click an
Event row/title to edit; **View** in its three-dot menu opens the overview. Trash rows open the
read-only overview.

Venues, Speakers and Tags use the Aurora list with shared quick/panel name search and
Active/Inactive filters. All sort by Name and Status; Venues also sort by City, Country and
Capacity, Speakers by Email (empty last), and Tags by Color. Text waits 300 ms; other filters
apply immediately. Filter/sort/page state survives reload and browser history. Resetting
filters preserves sorting and page size. Click a row or its Edit action to open the editor.
Checkboxes select records on the current page; confirmed Delete selected reports each failed
record and retries only those failures. Venues and Tags referenced by events, and Speakers
assigned to sessions, cannot be deleted, including when the event is in Trash.

The Venue form shows details and location together. The desktop aside holds Active, Capacity,
Summary and Save/Cancel; on mobile it follows the fields. Optional description, address and
capacity can be cleared. Server errors focus the affected field, and unsaved changes require
confirmation before leaving. Speakers use the same composition for Name, Email and Short
biography; optional email and biography can be cleared. Tags use Name and a six-digit HEX
Color, with a native color picker and live preview. Duplicate tag names show a field error
and retain the draft. Both forms put Active, Summary and Save/Cancel in the responsive aside.
Save/Cancel return to the base resource list; browser Back restores a previous list URL.

On narrow screens, **Open navigation** in the top bar opens navigation. Event form tabs scroll
horizontally and retain keyboard navigation. The Event editor shows Unsaved changes or Saving…
above its sections. Lists, History and Gallery distinguish loading, failed requests and empty
results; failed requests offer Retry or Refresh previews. See the
[implementation index](reference.md) for the corresponding code and focused checks.

Events use General, Schedule & location and Content & media tabs. The code is unique in the store
and read-only after creation. The sticky desktop aside holds Status, Featured, Capacity, Budget,
Summary and Save/Cancel; on mobile it follows the fields. Budget uses an exact EUR decimal string. Event times are
entered with native date/time inputs in Europe/Sofia; registration uses calendar dates. In person needs a Venue, Online
needs a meeting URL, and Hybrid needs both. Venue and Tag selectors search remotely and
page through matches; existing inactive selections remain labeled. Save validates all
sections, preserves failed input and opens the section containing the first field error.

Reference editors warn before discarding unsaved input on Cancel, navigation or store
switching. Switching returns to the same resource's list in the chosen store. Submitted
writes keep their initial store and entity even after navigation. Reload uses a native
browser warning for unsaved fields. Supporting deletion requires confirmation and fails
if referenced. Move to trash hides an Event while retaining its data and reserved code;
choose the **Trash** header tab to find it. Trash retains the previous status; **Restore**
returns the Event, its Sessions and Gallery to active use. In Trash, Show is read-only with
History and Restore; editing and child access require restoration. Import/export is absent.

Select rows on the current Event page to **Publish**, **Archive** or **Trash selected**.
In Trash, use **Restore selected**. Confirmation applies to those explicit IDs only (at most
100); a foreign, missing or ineligible event rejects the whole selection. Selection resets
on pagination, filters, sorting, browser history and store changes. Failure retains selection
for retry. Reset filters preserves the Active/Trash tab.

Open **History** in the Event header for paginated saved changes: event fields/status,
Trash/Restore, Sessions and Gallery operations. Expand a row to inspect before/after values.
Times are Sofia; long values are excerpts and description HTML is shown as plain text.
Actors are `Anonymous` because authentication is not implemented. In Real, History begins
with recorded writes; existing backend seed fixtures have no fabricated earlier entries.
Prototype fixtures include their creation and Trash entries. History and its
associated change commit together. Apply the additive EventHistory migration with
`npm run db:migrate` when updating an existing installation.

In **Edit event → Content & media**, Summary stays plain text. Description provides paragraphs,
Heading 2/3, bold, italic, bullet/numbered lists, line breaks and web links. Select text,
choose **Link**, and enter an absolute http(s) URL; **Remove link** keeps its text.
Undo/Redo and standard keyboard shortcuts work within the editor. Pasted content keeps
supported formatting and removes embeds, images, scripts and styling. There is no HTML
source mode. The counter measures UTF-8 HTML bytes, including formatting, against 100 KiB.

**Save event** saves the description together with the other sections. Validation opens
Content & media and focuses the editor; failed saves preserve input. The editor is read-only during
submission. Clearing its content clears the saved description. Overview displays the saved
formatted content below Summary; Event tables do not request rich HTML. Speaker biographies
and Session summaries remain plain text.

In both modes, after the first Event save, **Content & media → Gallery** accepts up to 10 still JPEG, PNG
or WebP images (5 MiB and 20 megapixels each). **Add image** shows progress and permits Cancel
until finalization begins. Upload, **Set cover**, **Alt text** and **Remove** save immediately,
independently of Summary/Description and other Event fields. Removing an image is permanent
and asks for confirmation. Removing the cover selects the first remaining image.

Drag cards or use their arrow buttons, then **Save order**. **Cancel order** reloads the saved
order; failed saves keep the draft. Finish/cancel gallery work before **Save event**. The
existing unsaved-changes warning also covers gallery ordering. The overview shows the saved
gallery with full-size previews. Open an image, then use **Previous image**, **Next image** or
the arrow keys; Escape closes the preview. **Refresh previews** renews expired links, including after a
Reference restart. A failed or cancelled upload can be retried with Add image; pending slots
expire after ten minutes, or one hour when upload finished without finalization.

Reference stores files privately at `apps/reference/.media` by default. Set
`REFERENCE_MEDIA_ROOT` to a private persistent absolute directory to move it. Back up that
directory together with the Reference database. `REFERENCE_PUBLIC_URL` must be the browser-
reachable http(s) base URL for Reference (default loopback at its PORT); set Reference's
`ADMIN_ORIGIN` to the exact admin origin for upload CORS. No AWS credentials or object storage
service is required. Source code, Git, Nx and formatting exclude `.media/`. Storage cleanup
runs automatically at startup and every minute; it retries failed removals using persisted
keys. There is no separate worker to start. See the [upload contract](architecture/overview.md#event-media-and-direct-uploads).

Open an Event and choose **Sessions**. **Add session** opens an Aurora form
with title, summary, Sofia start/end times, room and a remote Speaker selector. Its event/summary
panel is sticky on desktop and follows the fields on mobile. Click a session title/row to edit,
or use its three-dot Edit/Delete menu. Save returns
to this Event's program. Each session must fit within the Event; overlaps are allowed.
Changing the Event dates cannot exclude existing sessions. The overview lists unique
speakers assigned to its sessions, including labeled inactive speakers.

Drag sessions or use the up/down buttons to change display order independently of time.
**Save order** persists it; **Cancel order** reloads the current server order. A failed save
keeps the draft for retry. If another user changed the program membership, cancel and
arrange the refreshed program again. Add/edit/delete are unavailable while an order draft
is open. There are at most 100 sessions per Event. Session deletion is permanent after
confirmation. Moving an Event to trash preserves its sessions and blocks their access.

Use title/code search above the Event table or the same field in **Filter**. The drawer also
contains Status, Format, Venue, Tag, Featured, start-date and capacity ranges. Text waits 300 ms;
other filters apply on change and combine with the text search. Invalid ranges show a message
and keep the last applied query until corrected. Dates include the complete selected calendar
days in Europe/Sofia. Sort with the column headers; **Columns** exposes additional sortable fields. Search, filters, sorting and pagination survive reload
and travel through overview/edit/back links. Switching stores resets them. **Columns** saves
its selection separately for each store in this browser; Reset filters preserves columns,
sort and page size, while Reset columns restores the default view.

The Event overview presents saved details and offers Edit, Publish/Archive and confirmed
Move to trash. Overview, Sessions and History tabs follow the page header. All displayed times identify Sofia;
registration remains a calendar-date range.

Local defaults enable Reference. Set `REFERENCE_ENABLED=false` in the Reference environment
and `VITE_REFERENCE_ENABLED=false` in the admin environment to disable it; restart the service
and restart/rebuild the admin. The backend blocks business operations even if the UI flag
is stale. Health and the static schema remain; stored records are preserved. Invalid backend
flag values fail startup. This flag does not provide authentication.

Keep the Reference process running when disabled: its health endpoint and static GraphQL
schema remain part of the application. Disabling it blocks its GraphQL business operations,
entity lookups and binary HTTP upload/read endpoints, while Products remains usable.
Turning the flags back on restores access to the same records and media; no migration or
reseed is required.

Reference uses loopback port 11086. Gateway `REFERENCE_GRAPHQL_URL` must match a changed
service port, and Reference `CORE_GRAPHQL_URL` controls creation-time store validation.
Gateway and Reference accept JSON bodies up to 1 MiB so a 100 KiB description fits with JSON
escaping and the other form fields; the description's stricter size limit is checked by
Reference. Oversized HTTP bodies are rejected before GraphQL validation.
See [Reference's environment example](../apps/reference/.env.example). `db:setup`,
`db:test:setup`, `db:migrate`, `db:generate`, `db:validate` and `db:seed` include Reference.
Seeds insert three Venues, three Tags, two Speakers and two Events across Sofia and
Plovdiv without updating existing records. The Events are Sofia Creative Forum and
Plovdiv Culture Exchange. Run migrations and seeds before opening the new resources.

## Admin translations

The admin owns an i18next instance for the active URL language, shared by React's I18nextProvider and
Refine's i18nProvider in both data modes. It initializes synchronously from bundled
[Bulgarian](../apps/admin-react/src/i18n/locales/bg.json) and
[English](../apps/admin-react/src/i18n/locales/en.json) JSON catalogs. The default language is
`bg`; missing or empty translations fall back to `en` without changing the selected
language. React receives its instance explicitly through I18nextProvider; it does not use a
global React translation instance. Provider errors, startup guidance and standalone validation
reuse one separate instance through i18next's fixed-language translators. There is no translation
server or browser language detection.

Each catalog groups keys into `common`, `validation`, `shell`, `stores`, `products`,
`reference` and `prototype` namespaces. Reference groups its keys by Events, Sessions,
Media, History, Venues, Speakers and Tags. English defines the TypeScript key types through
[i18next's declaration](../apps/admin-react/src/i18n/i18next.d.ts). Use react-i18next's typed
`useTranslation('products')` and `t('form.name')` for catalog keys; Refine's runtime string
keys use its supplied default message when the catalog has no translation.
Messages use i18next parameters such as `{{max}}` and `_one`/`_other` plural entries selected
by `count`. React escapes rendered text; translations are plain text.

Every admin URL starts with `/bg` or `/en`, for example
`/bg/stores/<storeId>/products`. An address without a supported language redirects with
`replace` to its `bg` version, retaining the query and hash; an unknown application path
returns to discovery in the selected language. The menu shows Български and English and
changes only the prefix. Reload, Back and Forward use the URL language; there is no cookie,
localStorage language preference or browser-language detection. The document's `lang`
attribute follows the route.

Use [localized routing helpers](../apps/admin-react/src/i18n/routing.ts) for internal links and
navigation. They add the active prefix to absolute paths and preserve relative navigation
and history steps. Refine's `changeLocale` also navigates through the router, preserving the
current path, query and hash. Products and Reference share the
[unsaved-changes guard](../apps/admin-react/src/features/use-unsaved-changes.tsx), which confirms
Cancel, language/store changes, module navigation and browser history when a form is dirty.
Confirmed navigation remounts feature UI; pending server writes retain their
original store and language, and old editor callbacks cannot redirect the new screen.

[The GraphQL data provider](../apps/admin-react/src/data/data-provider.ts) receives the URL language
and includes `Accept-Language: bg|en` in each request, including store discovery. Providers
capture this value; they do not mutate a global header. Resource names and the shared Refine
cache remain store-scoped because record data is not translated. Prototype Reset clears the
cache and forms and returns to discovery with the current language prefix.

Products and Reference list/editor/form text, filters, enum labels, local validation and
success/deletion messages use the catalogs in both modes. Reference includes Sessions,
Gallery/upload controls, rich-text controls and History labels. History subjects and stored
before/after values are displayed as received. The shell includes translated navigation,
local search, theme/profile/notification menus and store discovery/selection states. Shared
actions, breadcrumbs, pagination, refresh warnings and unsaved-change confirmations also
use translations. Prototype Reset and the UI catalog translate their controls and feedback;
catalog preview state stays local and creates no business requests.
Startup failures show guidance in the URL language and preserve the original error as a diagnostic.

The Aurora theme merges MUI and Data Grid's bundled `bgBG` or `enUS` locale settings,
including Autocomplete and selection controls. Theme preferences persist through language
changes. [Display formatting](../apps/admin-react/src/i18n/use-format.ts) uses `Intl` with `bg-BG`
or `en-GB`, reusing one formatter set per supported language; event, session and History
timestamps remain in `Europe/Sofia`. Budgets keep
EUR and their exact decimal-string API values. Native date/time and decimal input formats
remain unchanged. Provider-generated network/store errors and upload transport errors use
the language captured by their caller. API enum values, record content and backend messages
are not translated by the frontend.

## Admin appearance and navigation

The admin uses Aurora's simple single-column Sidenav shell without a footer. All enabled
module groups appear together in one list. The top-bar button switches desktop navigation
between 256 px with labels and 72 px with icons and tooltips. At tablet widths, expansion
overlays content and closes after selection or a backdrop click; mobile uses a temporary
drawer. The Prototype/Real indicator and store selector stay in the top bar on desktop
and below it on mobile. There is no separate group rail or sidebar profile panel.

The theme button selects Aurora presets, primary colors and light/dark/system mode.
Preferences persist in `holita.appearance`, `holita-mode`, `holita-color-scheme-*` and
`holita.sidenavCollapsed` localStorage keys. Clear those keys to restore defaults.
Products and all Reference screens, including Sessions, Gallery, speaker summaries and History,
and store discovery/unavailable states follow the selected Aurora preset. Search finds enabled modules
locally; profile and notifications remain presentation examples. The language menu uses the URL locale.
An open search preserves its text when switching between the mobile dialog and desktop
popover. Closing it restores focus to the current search control. Search navigation uses
the same unsaved-change confirmation as the sidenav and store selector.
Notification read/remove actions keep keyboard focus inside the panel when their control
becomes disabled or disappears, so Escape can close it and return to the notification button.

Shell code and selected theme overrides are in `apps/admin-react/src/layout` and
`apps/admin-react/src/theme`. MUI, MUI X Data Grid Community, Emotion, Iconify and SimpleBar are installed through the
existing workspace lockfile. The selected icon data is bundled; font and avatar assets
are under `apps/admin-react/public`; temporary example avatars are grouped in `public/images/tmp/avatar`.
No sibling theme server, new environment variables or
external font/icon service is needed. Start the admin with the normal dev commands.

At the root page, choose a store to open its Products list. A failed store request shows the
gateway error and **Retry**; an empty successful response explains that a store must be set up.
An unavailable store URL offers the available stores. These states do not issue feature requests.
The interface uses MUI throughout; Ant Design and its compatibility providers/styles are absent.

## Using Products

Open http://127.0.0.1:11081 and select a store. Seeded stores are holita Sofia and holita Plovdiv.
The store switcher stays available on list/create/edit screens. Store-scoped URLs can be
bookmarked or reloaded. Switching returns to the new store's list and resets pagination
after confirmation when the current form has unsaved changes. A submitted operation retains its original store and may finish
after switching; return to that store to see the result.
Navigation between create/edit routes within the same store also starts a separate editor;
an earlier submitted write cannot redirect or overwrite the newly opened form.
Save/Cancel return to the base Products list. Browser Back restores a previous list URL.
Dirty forms require confirmation before Cancel, language/store changes, module navigation
or browser history. Keep editing preserves the draft and URL; Discard changes allows the
navigation. Leaving/reloading the page uses the browser's standard warning. Successful
Save returns directly to the list; submitted writes do not block navigation.

The Aurora list uses server pagination (20 rows by default; choices 10, 20, 50, 100).
Search matches name or SKU. The quick search and the search field in **Filter** share the
same value; editing either updates both. Search, status and the SKU substring filter combine.
Status changes apply immediately, and text changes apply after a 300 ms pause. Filters and
page settings persist in the URL and survive reload. Click **Name**, **SKU** or **Status**
to cycle through ascending, descending and the default newest-first order. Sorting applies
to all matching products before pagination and survives reload/browser history through
`sort` and `order` URL parameters. Changing it returns to page one. **Clear filters** preserves
sorting and page size while clearing search in both places, status and SKU together. On wide
screens, the filter panel sits to the left of the table; smaller screens use a temporary drawer.

Click a name or record cell to edit. The three-dot menu offers **Edit** and **Delete**.
Checkboxes select rows on the current page; changing page, filters or sorting clears that selection.
**Delete selected** confirms the selected count, then deletes those records sequentially.
Partial failures list the remaining records; retry submits only those records. Navigating
away stops unsent deletes while the current request retains its original store.

Create/edit use Aurora's form layout, with a sticky right panel for status, summary and
Save/Cancel on desktop; that panel follows the fields on mobile. Both share one form: name 1..200 and SKU 1..100 trimmed Unicode code points, case-sensitive SKU uniqueness
within a store, Draft default and Active option. Save disables the form while pending;
delete requires confirmation. Read failures offer Retry, and write failures preserve the
form for correction. There is no authentication, store administration or Dev Lab.

The backend GET /health response is `{ "status": "ok", "service": "core" }` (with the
corresponding service name). It requires no store header or database. Business operations
use /graphql. Health remains independent of PostgreSQL and other services.

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
for creation validation. URLs default to core 11082 and products 11083 on loopback.
Gateway ADMIN_ORIGIN defaults to http://127.0.0.1:11081 for browser CORS; update it if moving
admin. x-store-id and x-request-id are allowed headers; x-request-id is exposed in responses.

Use the gateway at http://127.0.0.1:11080/graphql. For store discovery, no headers are needed:

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
  `npm run dev:admin-react:mock` and open http://127.0.0.1:11087. `dev:admin-react` starts Real, and
  changing `.env` while Vite is running does not change that process's data mode.
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
- Busy port: stop the process you own or explicitly choose another port. Vite strictPort
  avoids silently moving the admin; Nest reports its listen error.
- Invalid PORT: correct the application .env/process environment and restart the process.
- No tests found: see [testing](testing.md); this is not a successful check.
- Missing affected base: use a real local commit or fetch the intended base yourself;
  do not assume origin/main exists. `--base=HEAD` compares local work against the current
  commit, including untracked source files, rather than an entire PR.
- After Ctrl+C, verify the task's ports are released before starting another copy.
