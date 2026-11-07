# Admin UI v2 follow-ups

Pending acceptance and deployment work only. The implemented navigation, sign-in, notifications,
command/SMS workflows and shared presentation belong to
[Discocan development](../discocan/development.md) and the
[admin design system](../admin-design-system.md).

## Owner feedback, 2026-11-07 (approved)

The owner's acceptance review asks for the changes below. Each package owns its files, so the
packages can run in parallel. Defaults approved with the plan: "Прочетени параметри" names the
parameter read-back, and real alerts on the test trucks stay untouched.

### P1 Navigation, Settings and loading

- Sidebar: Dashboard, Vehicles, Devices, Drivers, Maintenance, then Settings and Users without a
  group heading. "General" becomes "Settings" and opens the tabs General | Vehicle groups. Vehicle
  groups leave the sidebar; Users leaves the Settings tabs.
- The Fleet workspace no longer flashes a "Fleet" card while Branch preferences load: the
  preferences stay loaded per Branch across pages, and a neutral skeleton replaces the card.
- `index.html` shows a theme-aware splash until the application renders; route changes show a thin
  progress bar.
- "Live" (BG "На живо") becomes "Online" (BG "Онлайн") everywhere.
- Files: `workspace/`, `features/fleet/fleet-workspace.*`, `features/fleet/settings/`,
  `features/users/`, `layout/` except the breadcrumb, `index.html`, navigation catalogs.

### P2 Vehicle detail, breadcrumb and maps

- Header: the plate is the title and the description its subtitle; the duplicate "Vehicle"
  eyebrow goes.
- Breadcrumb: on a sub-tab the record (plate or device) links to its overview tab.
- The tabs follow the header directly as the page's main navigation, and the summary card moves
  into Overview. Every hint paragraph (`hints.*`, `*Hint`) goes, so tabs lead straight to cards.
- Maps: detail maps are taller (about 60% of the viewport); the dashboard map spans the full width
  with the attention panel below it. The coordinate list ("Records and positions") appears only
  when the map cannot render.
- Files: `features/fleet/vehicles/vehicle-profile-*`, `features/fleet/overview/`,
  `ui/location-map/`, `layout/page-record.ts`, `layout/admin-topbar.html`.

### P3 Device detail

- Overview: one card style (Registry loses the accent); the problem link appears only when there is
  something to show; the position is the map only.
- SMS commands: a table with the command name (tooltip with its purpose), the SMS text in the
  current code style with a copy icon at its end, and an icon that opens the SMS app.
- Parameters: "Снимка на параметрите" becomes "Прочетени параметри" (EN "Read parameters"), and the
  tables use the standard table presentation.
- The same tab-first layout as P2.
- Files: `features/control-center/`.

### P4 AbortError in the console

- Origin: Angular HttpClient's fetch backend (`@angular/common` 22.2.1) aborts an in-flight GraphQL
  request when its subscription ends (navigation, filter change), and the AbortError reaches the
  ErrorHandler through `provideBrowserGlobalErrorListeners`. No data is lost.
- Reproduce it, then handle the cancelled request where it is left unhandled, or update Angular if a
  patch release fixes it. NG0751 is a development-only HMR notice and needs no change.

### P5 Sample data (development Branch, no code)

- Enter through the Fleet API: one driver per truck plus two drivers without a truck; the groups
  "Company trucks" and "Cargo trucks" with the trucks split between them; maintenance for every
  truck in every state (planned, overdue, done with completion data, cancelled).
- No invented telemetry, trips or device commands; only devices produce those.

Other production/release prerequisites remain in the
[presentation and release backlog](admin-design-system.md#release-decisions).
Physical device verification, additional command families and recovery work remain in the
[ERM roadmap](erm-roadmap.md).
