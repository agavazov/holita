import copy
import io
import json
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile
import zlib
from pefile import PEFormatError

import catalog

ROOT = Path(__file__).resolve().parents[2]
EXE = (
    ROOT
    / "resources/discocan/Simple eData FMS Monitor/Simple eData FMS Monitor v9.56.exe"
)


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.TemporaryDirectory(prefix="holita-edata-test-")
        cls.input = Path(cls.scratch.name) / EXE.name
        shutil.copyfile(EXE, cls.input)
        cls.before_hash = catalog.sha256(cls.input.read_bytes())
        cls.data = catalog.extract(cls.input, "v9.56")
        cls.pe, _, cls.workbooks = catalog.inventory(cls.input)

    @classmethod
    def tearDownClass(cls):
        cls.scratch.cleanup()

    def test_exe_only_baseline_and_source_preservation(self):
        self.assertEqual(list(Path(self.scratch.name).iterdir()), [self.input])
        self.assertEqual(self.before_hash, catalog.sha256(self.input.read_bytes()))
        self.assertEqual(
            self.before_hash,
            "01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0",
        )
        self.assertEqual(len(self.data["parameters"]), 5488)
        workbooks = {
            s["key"]: s for s in self.data["sources"] if s["kind"] == "workbook"
        }
        self.assertEqual(
            {
                key: sum(s["rows"] for s in value["evidence"]["sheets"])
                for key, value in workbooks.items()
            },
            {
                "fc5b14a719d3c20affc48afb29bb4c7678504547a9740b6ccce649ad9569e96f": 1855,
                "a5548b5c20ae5d8d6188692dea6254c6b624086c50d7605608fcfef0a4ea929b": 1819,
            },
        )
        for key in workbooks:
            self.assertEqual(
                sum(
                    "decimal_hex_mismatch" in p["details"]["issues"]
                    for p in self.data["parameters"]
                    if p["sourceKey"] == key
                ),
                20,
            )
        self.assertEqual(
            len(
                workbooks[
                    "fc5b14a719d3c20affc48afb29bb4c7678504547a9740b6ccce649ad9569e96f"
                ]["evidence"]["locations"]
            ),
            3,
        )
        self.assertEqual(
            self.data["profiles"],
            [
                {
                    "vendorId": 343,
                    "setId": 135,
                    "categoryId": 3,
                    "name": "FMS Parameters (250k)",
                },
                {
                    "vendorId": 430,
                    "setId": 135,
                    "categoryId": 3,
                    "name": "FMS Parameters (500k)",
                },
            ],
        )
        self.assertEqual(
            len(
                next(s for s in self.data["sets"] if s["vendorId"] == 135)[
                    "parameterIds"
                ]
            ),
            1262,
        )

    def test_determinism_and_committed_catalog(self):
        other = catalog.extract(self.input, "v9.56")
        self.assertEqual(catalog.canonical(self.data), catalog.canonical(other))
        committed = (
            ROOT / "docs/discocan/erm-resources/simple-edata-catalog/v9.56/catalog.json"
        )
        self.assertEqual(json.loads(committed.read_text(encoding="utf-8")), self.data)

    def test_category_duplicates_and_shared_formula_provenance(self):
        records = [p for p in self.data["parameters"] if p["parameterId"] == 781]
        self.assertGreater(len(records), 3)
        self.assertEqual(len({p["key"] for p in records}), len(records))
        follower = next(
            p
            for p in self.data["parameters"]
            if p["sourceKey"] != "monitor" and p["details"]["row"] == 4
        )
        self.assertEqual(
            follower["details"]["cells"]["B"]["formula"]["sharedAnchor"]["cell"], "B3"
        )
        self.assertEqual(
            len(
                [
                    i
                    for i in self.data["issues"]
                    if i["kind"] == "set_member_without_monitor_definition"
                ]
            ),
            10,
        )

    def test_initializer_discovery_does_not_use_method_row_numbers(self):
        methods = self.pe.net.mdtables.MethodDef.rows
        model = SimpleNamespace(
            net=SimpleNamespace(
                mdtables=SimpleNamespace(
                    MethodDef=SimpleNamespace(rows=list(reversed(methods))),
                    Field=self.pe.net.mdtables.Field,
                )
            ),
            get_data=self.pe.get_data,
        )
        writes, evidence = catalog.constant_writes(model, "Parameters_Details_Array")
        self.assertEqual(len(writes), 1814 * 5)
        self.assertNotEqual(evidence["methodToken"], "0x06000001")

    def test_unsupported_instruction_and_layout_are_rejected(self):
        with patch.object(
            catalog,
            "CilMethodBody",
            return_value=SimpleNamespace(
                instructions=[
                    SimpleNamespace(opcode=SimpleNamespace(name="call"), operand=None)
                ]
            ),
        ):
            with self.assertRaisesRegex(
                ValueError, "Unsupported initializer instruction"
            ):
                catalog.constant_writes(self.pe, "Parameters_Details_Array")
        original = catalog.constant_writes

        def incomplete(pe, symbol):
            writes, evidence = original(pe, symbol)
            if symbol == "Parameters_Details_Array":
                del writes[0]
            return writes, evidence

        with patch.object(catalog, "constant_writes", side_effect=incomplete):
            with self.assertRaisesRegex(ValueError, "Unsupported memory layout"):
                catalog.monitor_records(self.pe)

    def test_missing_truncated_and_corrupt_input_are_rejected(self):
        with self.assertRaises(FileNotFoundError):
            catalog.extract(Path(self.scratch.name) / "missing.exe", "test")
        with self.assertRaises(ValueError):
            list(catalog.archive_candidates(b"PK\x05\x06"))
        broken = bytearray(self.workbooks[0]["payload"])
        broken[1000] ^= 0xFF
        with self.assertRaises((ValueError, zipfile.BadZipFile, zlib.error)):
            list(catalog.archive_candidates(bytes(broken)))
        bad = Path(self.scratch.name) / "truncated.exe"
        bad.write_bytes(EXE.read_bytes()[:32])
        try:
            with self.assertRaises((ValueError, PEFormatError)):
                catalog.extract(bad, "test")
        finally:
            bad.unlink()

    def test_unrecognized_workbook_columns_are_rejected(self):
        original = self.workbooks[0]
        out = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(original["payload"])) as src, zipfile.ZipFile(
            out, "w"
        ) as dest:
            for name in src.namelist():
                value = src.read(name)
                if name == "xl/sharedStrings.xml":
                    value = value.replace(b"Parametr ID (Dec)", b"Unknown ID format")
                dest.writestr(name, value)
        with self.assertRaisesRegex(ValueError, "Unsupported headers"):
            catalog.workbook_records({**original, "payload": out.getvalue()})

    def test_diff_ignores_metadata_and_reports_domain_changes(self):
        changed = copy.deepcopy(self.data)
        changed["packageLabel"] = "another label"
        changed["extractorVersion"] = "next"
        changed["source"]["fileName"] = "renamed.exe"
        self.assertEqual(catalog.compare(self.data, changed)["changed"], [])
        changed["parameters"][0]["name"] = "Renamed parameter"
        changed["parameters"][1]["multiply"] = "2.0"
        changed["sets"][0]["parameterIds"].append(99999)
        changed["profiles"][0]["setId"] = 9999
        result = catalog.compare(self.data, changed)
        self.assertEqual(len(result["changed"]), 4)
        changed["parameters"][0]["category"] = "new category"
        result = catalog.compare(self.data, changed)
        self.assertEqual((len(result["added"]), len(result["removed"])), (1, 1))

    def test_diff_reports_formula_changes_and_retains_original_records(self):
        changed = copy.deepcopy(self.data)
        parameter = next(
            p for p in changed["parameters"] if p["sourceKey"] != "monitor"
        )
        parameter["details"]["cells"]["B"]["formula"]["text"] = "DEC2HEX(A3+1)"
        parameter["details"]["cells"]["B"]["formula"]["sharedAnchor"][
            "text"
        ] = "DEC2HEX(A3+1)"
        report = catalog.compare(self.data, changed)
        self.assertGreater(len(report["changed"]), 0)
        self.assertIn("details", report["changed"][0]["after"]["records"][0])


if __name__ == "__main__":
    unittest.main()
