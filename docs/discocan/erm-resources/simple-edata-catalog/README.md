# Simple eData Monitor versioned catalog

Fleet owns a shared, versioned vendor reference catalog, independent of Tenant/Branch.
Vehicle/Device records retain their existing Tenant/Branch isolation. The catalog has
no GraphQL endpoint or admin screen and does not generate or send device commands.
[v9.56](v9.56/README.md) is the initial extracted reference.

## Sources and prerequisites

The only required input is a supplied Monitor EXE. Original binaries are retained in
[resources/discocan/Simple eData FMS Monitor](../../../../resources/discocan/Simple%20eData%20FMS%20Monitor/README.md).
Keep each version's original filename and bytes. No unpacked XML, firmware INI,
existing JSON, credentials or device connection is needed for extraction. Vendor
download discovery and automatic updates are not implemented.

Use the repository's Ubuntu/WSL Node environment and installed npm dependencies.
Python 3.10+ with venv/pip support is required. On Ubuntu, install the venv package
matching the selected Python interpreter if absent. Create an isolated ignored environment:

```bash
python3 -m venv .references/erm-edata-venv
.references/erm-edata-venv/bin/python -m pip install -r tools/erm-edata/requirements.txt
```

The three parser packages are pinned in `tools/erm-edata/requirements.txt`; they are
development tools, not application runtime dependencies. Extraction runs on the host
without starting the EXE, loading its assemblies or using a debugger.

## Inspect a supplied version

Run from the repository root. Set the EXE and independent operator-supplied label:

```bash
exe='resources/discocan/Simple eData FMS Monitor/Simple eData FMS Monitor v9.56.exe'
label='v9.56'
work=$(mktemp -d -t holita-edata-XXXXXX)
.references/erm-edata-venv/bin/python tools/erm-edata/catalog.py inspect "$exe" > "$work/inspection.json"
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
.references/erm-edata-venv/bin/python tools/erm-edata/catalog.py extract "$exe" \
  --label "$label" --out "$work/catalog"
.references/erm-edata-venv/bin/python tools/erm-edata/catalog.py diff \
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
boundaries and all constant writes/declared array lengths. Its supported format is
explicitly the x86 constant-array layout and recognized initializer instructions.
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

## Focused validation

```bash
.references/erm-edata-venv/bin/python -m unittest discover -s tools/erm-edata -p test_catalog.py -v
npm run test:fleet -- edata-catalog.unit.spec.ts --skip-nx-cache
npm run test:fleet:db -- edata-catalog.db.spec.ts initial-migration.db.spec.ts --skip-nx-cache
```

Python tests copy only the EXE into a fresh temporary input directory and verify both
variants, deterministic content, conflicts, duplicates, initializer discovery, invalid
input/layouts and comparison. DB tests use the guarded helper and per-run schemas in
`holita_fleet_test`, covering the full v9.56 import, concurrent/idempotent writes,
rollback and corruption detection. The workflow adds no npm commands; existing npm
targets remain the repository validation interface. Follow [shared checks](../../../testing.md)
for tooling changes.
