# Simple eData Monitor versioned catalog

Fleet owns a shared, versioned vendor reference catalog, independent of Tenant/Branch.
Vehicle/Device records retain their existing Tenant/Branch isolation. The catalog has
no import/editing API or standalone catalog screen. Fleet DeviceOperations exposes
eligible predefined options in its configuration editor and owns any device operation;
the offline catalog tools do not send commands.
[v9.56](v9.56/README.md) is the initial extracted reference.

## Sources and prerequisites

The only required input is a supplied Monitor EXE. Original binaries are retained in
[resources/discocan/Simple eData FMS Monitor](../../../../resources/discocan/Simple%20eData%20FMS%20Monitor/README.md).
Keep each version's original filename and bytes. No unpacked XML, firmware INI,
existing JSON, credentials or device connection is needed for extraction. Vendor
download discovery and automatic updates are not implemented.

Use the repository's Ubuntu/WSL Node 24 environment and dependencies installed with
`npm ci`. The TypeScript tools run through the existing `tsx` loader. XML parsing
and validation dependencies are pinned in the root npm manifest/lockfile; PE/CLI and
ZIP inspection use bounded readers and Node's native decompression/CRC support.
No Python, .NET runtime or external unpacker is required. Extraction runs on the
host without starting the EXE, loading its assemblies or using a debugger.

## Inspect a supplied version

Run from the repository root. Set the EXE and independent operator-supplied label:

```bash
exe='resources/discocan/Simple eData FMS Monitor/Simple eData FMS Monitor v9.56.exe'
label='v9.56'
work=$(mktemp -d -t holita-edata-XXXXXX)
node --import tsx tools/erm-edata/catalog.mts inspect "$exe" > "$work/inspection.json"
```

Compare the EXE hash with the previous catalog before processing an update. An unchanged
hash identifies the same supplied binary; its filename or label alone does not.
Inspection reports architecture, available Windows/assembly versions, native/managed
resource inventories, workbook hashes/locations/sheets, initializer names/tokens/RVAs,
supported layout and counts. It validates the supported extraction path without writing
catalog files or contacting a database. v9.56 has no Windows FileVersion/ProductVersion
values. The package label does not establish a device's installed firmware version.

## Extract and compare before import

```bash
node --import tsx tools/erm-edata/catalog.mts extract "$exe" \
  --label "$label" --out "$work/catalog"
node --import tsx tools/erm-edata/catalog.mts diff \
  docs/discocan/erm-resources/simple-edata-catalog/v9.56/catalog.json \
  "$work/catalog/catalog.json" --out "$work/diff.json"
```

Use the actual preceding accepted catalog as the first comparison input. Output paths
must be fresh; neither command overwrites existing output. Extraction writes canonical
`catalog.json`, English `README.md`, `run.json` with UTC analysis time/content digest,
and each distinct workbook under `workbooks/<sha256>.xlsx`. Timestamps are outside
catalog content. Identical input/label/extractor produces identical catalog bytes.
Do not hand-edit or reformat canonical JSON; regenerate it.

Review added/removed records, renamed parameters, conversion/formula changes, set
defaults/membership and profile/category changes in `diff.json`. Category moves appear
as a removal and addition. Duplicates remain category/source-specific multisets.
Every reported difference includes original records/provenance; issue lists before
and after support conflict review. Archive hashes/locations and row shifts alone do
not create semantic changes. There is no assumed preferred workbook.

The tool checks PE resources, workbook relationships/shared strings, CRCs, ZIP directory
boundaries and all constant writes/declared array lengths. Relative workbook targets resolve
from their owning part; absolute targets resolve from the package root. External targets and
paths escaping that root are rejected. Its supported format is
explicitly the x86 constant-array layout and recognized initializer instructions.
ZIP input supports single-disk, non-ZIP64 archives with stored/deflated entries,
ASCII or UTF-8 filenames, at most 10,000 entries and 100 MB total expanded data.
Encrypted archives, external XML relationships and DTD/entity declarations are rejected.
Missing workbooks, unknown headers, incomplete tables, unsupported architecture/code,
invalid profile references and corruption stop extraction. Inspect a changed format
and extend the parser with focused fixtures before import. Never substitute old XML
for missing coverage in a new EXE.

Review `coverage` and `issues` even after successful extraction. Each v9.56 workbook
has 20 decimal/hex disagreements; ten distinct set-member IDs lack Monitor definitions.
These preserved source issues do not imply incomplete decoding of the supported tables.
Cached formula values are not recalculated or treated as corrections. Shared formula
masters/ranges remain available beside each follower.

## Migrate, preview, import and verify

The CLI supports only the local development database `holita_fleet` using the Fleet
role and `apps/fleet/.env`/`FLEET_DATABASE_URL` through the existing connection config.
Other/nonlocal databases and URL options are rejected. Passwords are never logged.
Provision PostgreSQL and development/test roles using [workspace setup](../../../development.md#postgresql-and-prisma).
Apply the reviewed additive migration and regenerate the client directly:

```bash
(cd apps/fleet && node ../../node_modules/prisma/build/index.js migrate deploy)
(cd apps/fleet && node ../../node_modules/prisma/build/index.js generate)
node --import tsx apps/fleet/src/modules/edata-catalog/cli.ts \
  --catalog "$work/catalog/catalog.json" --exe "$exe"
```

The default preview is read-only. It verifies the EXE hash, file contract, coverage,
source references, memberships, unique keys and profile relationships. It prints
`would_insert` or verifies all stored rows for an existing import, plus `contentSha256`.
After reviewing inspection, differences and preview, supply that exact digest to write:

```bash
node --import tsx apps/fleet/src/modules/edata-catalog/cli.ts \
  --catalog "$work/catalog/catalog.json" --exe "$exe" \
  --write --expect-sha256 '<reviewed contentSha256>'
node --import tsx apps/fleet/src/modules/edata-catalog/cli.ts \
  --catalog "$work/catalog/catalog.json" --exe "$exe"
```

The writer takes a per-version transaction lock, inserts all seven tables atomically
and compares every stored row and metadata before commit. Repeated imports verify
the same version without duplication or overwriting. Failures roll back the whole
new import. Existing versions and Vehicle/Device data remain intact; no active version
is selected automatically. EXE hash + extractor version + schema version identifies
an extraction. Changed content under that identity is rejected. Parser corrections
require a reviewed extractor-version change and fresh extraction. Keep labels stable
when repeating an extraction.

Retain accepted output under this directory with a distinct version/revision name and
add its link here; retain the original EXE in `resources/`. The generated README assumes
this directory layout. Test reports belong outside product documentation; `run.json`
contains extraction provenance only.

## Data interpretation and persistence

`EdataCatalog` stores identity/digest plus source, coverage, issues and candidate mappings
in JSON metadata. `EdataCatalogSource` stores workbook hashes/locations and initializer
evidence. `EdataCatalogParameter` retains every source row, category, conversion text
and raw cells/formulas. Sets, ordered members, categories and profiles occupy separate
related tables. Composite foreign keys prevent cross-version relationships. Set members
retain vendor IDs rather than choosing an ambiguous parameter-row foreign key.

Mappings list Monitor/workbook candidates matched by ID, preserving each category.
They do not assert category equivalence, units, CAN headers/bit layouts, Karma IDs,
hardware support or live measurements. Baud codes and profile names remain independent
facts. This procedure does not load settings into a device.

## Runtime parameter presets

The [durable configuration flow](../../architecture.md#background-device-configuration-reads)
uses only the imported Monitor 9.56 EXE SHA-256
`01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0`, extractor
`1.0.0`, schema `1`. `fleetDeviceParameterPresets` returns an ID only when its
Monitor-source candidates have one nonempty name, no row issues and membership in
at least one profile's set. Repeated category rows with the same name are retained
in the source catalog; conflicting names exclude the ID from selectable presets.
Workbook conversion fields are not used to construct a CAN decoding definition.

Before an addition, Fleet reads the selected device profile and requires membership
in that profile's set, rereads the complete baseline and rechecks eligibility at
dispatch. It uses the
[offline-verified Monitor predefined constructor](../edata-simple-protocol-v4.04/parameter-reporting.md#monitor-956-predefined-parameter-construction)
for exactly one additive definition. Another imported version is not automatically
eligible for this constructor. There is no inferred firmware compatibility, signal
availability or calibration guarantee.

Existing interval changes use captured device definitions, including unknown IDs,
and do not require a catalog candidate. The server changes only the final two
interval bytes, then verifies the full returned configuration. Catalog import,
configuration readback and measurement verification remain distinct evidence.

## Validation

The extractor and the Fleet import have no automated tests. Review a new catalog with the
`extract` and `diff` procedure above before committing it; the Fleet import CLI checks the EXE
SHA-256 and the content digest again before it writes. Follow [shared checks](../../../testing.md)
for tooling changes.
