"""Static Simple eData Monitor catalog extraction. Never loads or executes the EXE."""

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import posixpath
import re
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile
import zlib

import dnfile
from pefile import PEFormatError
from dncil.cil.body import CilMethodBody
from dncil.cil.body.reader import CilMethodBodyReaderBytes

SCHEMA_VERSION = 1
EXTRACTOR_VERSION = "1.0.0"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def xml(data):
    require(
        b"<!DOCTYPE" not in data.upper() and b"<!ENTITY" not in data.upper(),
        "DTD/entity XML is unsupported",
    )
    return ET.fromstring(data)


def archive_candidates(data):
    """Delimit each archive using its EOCD directory size/offset, not a PK split."""
    start = 0
    while (end := data.find(b"PK\x05\x06", start)) >= 0:
        start = end + 4
        require(end + 22 <= len(data), "Truncated ZIP end record")
        _, disk, cd_disk, on_disk, total, size, offset, comment = struct.unpack_from(
            "<4s4H2IH", data, end
        )
        require(disk == cd_disk == 0 and on_disk == total, "Split ZIP is unsupported")
        require(
            total != 65535 and size != 0xFFFFFFFF and offset != 0xFFFFFFFF,
            "ZIP64 is unsupported",
        )
        first, last = end - size - offset, end + 22 + comment
        require(first >= 0 and last <= len(data), "Invalid ZIP boundaries")
        payload = data[first:last]
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            names = archive.namelist()
            require(len(names) == len(set(names)), "Duplicate ZIP entry names")
            require(
                len(names) <= 10000
                and sum(v.file_size for v in archive.infolist()) <= 100_000_000,
                "Oversized workbook",
            )
            require(
                all(not v.flag_bits & 1 for v in archive.infolist()),
                "Encrypted workbook",
            )
            require(archive.testzip() is None, "ZIP CRC failure")
            if "[Content_Types].xml" in names and "_rels/.rels" in names:
                yield first, payload


def inventory(path):
    raw = path.read_bytes()
    pe = dnfile.dnPE(data=raw)
    require(pe.net is not None and pe.net.mdtables is not None, "Missing CLI metadata")
    resources, workbooks = [], {}

    def collect(data, base, location):
        count = 0
        for relative, payload in archive_candidates(data):
            count += 1
            key = sha256(payload)
            item = workbooks.setdefault(
                key, {"key": key, "locations": [], "payload": payload}
            )
            evidence = {**location, "offset": base + relative, "bytes": len(payload)}
            if evidence not in item["locations"]:
                item["locations"].append(evidence)
        return count

    def walk(entries, parts):
        for entry in entries:
            identity = str(entry.name) if entry.name is not None else str(entry.id)
            names = [*parts, identity]
            if hasattr(entry, "directory"):
                walk(entry.directory.entries, names)
            else:
                descriptor = entry.data.struct
                data = pe.get_data(descriptor.OffsetToData, descriptor.Size)
                require(len(data) == descriptor.Size, "Truncated PE resource")
                offset = pe.get_offset_from_rva(descriptor.OffsetToData)
                resources.append(
                    {
                        "path": "/".join(names),
                        "offset": offset,
                        "bytes": len(data),
                        "sha256": sha256(data),
                    }
                )
                count = collect(
                    data, offset, {"kind": "resource", "path": "/".join(names)}
                )
                require(
                    names[0] != "EXCEL" or count > 0,
                    "EXCEL resource has no supported workbook",
                )

    if hasattr(pe, "DIRECTORY_ENTRY_RESOURCE"):
        walk(pe.DIRECTORY_ENTRY_RESOURCE.entries, [])
    for section in pe.sections:
        collect(
            section.get_data(),
            section.PointerToRawData,
            {"kind": "section", "path": section.Name.rstrip(b"\0").decode("ascii")},
        )
    versions = []
    for group in getattr(pe, "FileInfo", []):
        for item in group:
            for table in getattr(item, "StringTable", []):
                versions.append(
                    {
                        k.decode("utf-8"): v.decode("utf-8")
                        for k, v in table.entries.items()
                    }
                )
    assemblies = pe.net.mdtables.Assembly.rows if pe.net.mdtables.Assembly else []
    assembly_identity = [
        {
            "name": str(a.Name),
            "version": f"{a.MajorVersion}.{a.MinorVersion}.{a.BuildNumber}.{a.RevisionNumber}",
        }
        for a in assemblies
    ]
    source = {
        "fileName": path.name,
        "sha256": sha256(raw),
        "bytes": len(raw),
        "machine": pe.FILE_HEADER.Machine,
        "binaryVersionInfo": versions,
        "assemblyIdentity": assembly_identity,
        "managedResources": [
            str(r.Name)
            for r in (
                pe.net.mdtables.ManifestResource.rows
                if pe.net.mdtables.ManifestResource
                else []
            )
        ],
        "nativeResources": resources,
    }
    require(workbooks, "No embedded workbook found; extraction coverage is incomplete")
    return pe, source, sorted(workbooks.values(), key=lambda v: v["key"])


def relationship_targets(archive, part):
    parent, name = posixpath.split(part)
    relpath = f"{parent}/_rels/{name}.rels" if parent else f"_rels/{name}.rels"
    result = {}
    for rel in xml(archive.read(relpath)).findall(f"{{{REL_NS}}}Relationship"):
        require(
            rel.get("TargetMode") != "External",
            "External workbook relationship is unsupported",
        )
        target = posixpath.normpath(
            posixpath.join(parent, rel.attrib["Target"]).lstrip("/")
        )
        require(
            not target.startswith("../") and target in archive.namelist(),
            "Invalid workbook relationship",
        )
        result[rel.attrib["Id"]] = (rel.attrib["Type"].rsplit("/", 1)[-1], target)
    return result


def workbook_records(item):
    records, sheets = [], []
    with zipfile.ZipFile(io.BytesIO(item["payload"])) as archive:
        roots = [
            r
            for r in xml(archive.read("_rels/.rels"))
            if r.get("Type", "").endswith("/officeDocument")
        ]
        require(
            len(roots) == 1 and roots[0].get("TargetMode") != "External",
            "Unsupported workbook root",
        )
        main = roots[0].attrib["Target"].lstrip("/")
        targets = relationship_targets(archive, main)
        shared = [
            target for kind, target in targets.values() if kind == "sharedStrings"
        ]
        require(len(shared) <= 1, "Ambiguous shared strings")
        strings = (
            [
                "".join(t.text or "" for t in si.iter(f"{{{NS['s']}}}t"))
                for si in xml(archive.read(shared[0]))
            ]
            if shared
            else []
        )
        for sheet in xml(archive.read(main)).findall("s:sheets/s:sheet", NS):
            name = sheet.attrib["name"]
            kind, path = targets[sheet.attrib[f"{{{DOC_REL_NS}}}id"]]
            require(kind == "worksheet", "Unsupported workbook sheet type")
            rows, anchors = [], {}
            for row in xml(archive.read(path)).findall("s:sheetData/s:row", NS):
                cells = {}
                for cell in row.findall("s:c", NS):
                    address, celltype = cell.attrib["r"], cell.get("t", "n")
                    column = re.fullmatch(r"([A-Z]+)[1-9][0-9]*", address)
                    require(column is not None, "Invalid cell address")
                    raw = cell.findtext("s:v", None, NS)
                    if celltype == "s":
                        require(
                            raw is not None and 0 <= int(raw) < len(strings),
                            "Invalid shared string index",
                        )
                        value = strings[int(raw)]
                    elif celltype == "inlineStr":
                        value = "".join(
                            t.text or "" for t in cell.findall("s:is//s:t", NS)
                        )
                    else:
                        value = raw
                    detail = {
                        "address": address,
                        "type": celltype,
                        "raw": raw,
                        "value": value,
                    }
                    formula = cell.find("s:f", NS)
                    if formula is not None:
                        detail["formula"] = {
                            "text": formula.text,
                            "attributes": dict(formula.attrib),
                        }
                        if formula.get("t") == "shared" and formula.text:
                            require(
                                formula.attrib["si"] not in anchors,
                                "Duplicate shared formula anchor",
                            )
                            anchors[formula.attrib["si"]] = {
                                "cell": address,
                                "text": formula.text,
                                "range": formula.get("ref"),
                            }
                    cells[column[1]] = detail
                rows.append((int(row.attrib["r"]), cells))
            headers = [
                (r, c)
                for r, c in rows
                if c.get("A", {}).get("value") == "Parametr ID (Dec)"
            ]
            require(len(headers) == 1, f"Unsupported headers in {name}")
            header_row, headers = headers[0]
            require(
                headers.get("B", {}).get("value") == "Parametr ID (Hex)"
                and headers.get("C", {}).get("value") == "Parameter Name",
                f"Unsupported column layout in {name}",
            )
            count = 0
            for rownum, cells in rows:
                if rownum <= header_row or all(
                    c["value"] is None for c in cells.values()
                ):
                    continue
                decimal, title = cells.get("A", {}).get("value"), cells.get(
                    "C", {}
                ).get("value")
                require(
                    decimal is not None
                    and re.fullmatch(r"[0-9]+", decimal) is not None
                    and title,
                    f"Invalid parameter row {name}:{rownum}",
                )
                parameter_id = int(decimal)
                require(
                    parameter_id <= 2147483647,
                    "Parameter ID exceeds supported integer range",
                )
                for cell in cells.values():
                    formula = cell.get("formula")
                    if formula and formula["attributes"].get("t") == "shared":
                        anchor = anchors.get(formula["attributes"]["si"])
                        require(anchor is not None, "Missing shared formula anchor")
                        formula["sharedAnchor"] = anchor
                source_hex = cells.get("B", {}).get("value")
                require(
                    source_hex is not None
                    and re.fullmatch(r"[0-9a-fA-F]+", source_hex) is not None,
                    "Missing/invalid cached hex ID",
                )
                issues = (
                    ["decimal_hex_mismatch"]
                    if int(source_hex, 16) != parameter_id
                    else []
                )
                records.append(
                    {
                        "key": f"workbook:{item['key']}:{name}:{rownum}",
                        "sourceKey": item["key"],
                        "parameterId": parameter_id,
                        "category": name,
                        "name": title,
                        "multiply": cells.get("D", {}).get("value"),
                        "offset": None,
                        "details": {
                            "row": rownum,
                            "xmlPath": path,
                            "cells": cells,
                            "sourceHex": source_hex,
                            "calculatedHex": format(parameter_id, "X"),
                            "issues": issues,
                        },
                    }
                )
                count += 1
            require(count > 0, f"Empty parameter sheet {name}")
            sheets.append(
                {"name": name, "path": path, "rows": count, "headers": headers}
            )
        evidence = {
            "locations": item["locations"],
            "entries": [
                {
                    "path": f.filename,
                    "bytes": f.file_size,
                    "sha256": sha256(archive.read(f)),
                }
                for f in archive.infolist()
            ],
            "sheets": sheets,
            "runtimePurpose": "unresolved",
        }
    return {"key": item["key"], "kind": "workbook", "evidence": evidence}, records


def constant_writes(pe, symbol):
    methods = [
        (i, m)
        for i, m in enumerate(pe.net.mdtables.MethodDef.rows, 1)
        if "??__E" in str(m.Name) and f"@{symbol}@" in str(m.Name)
    ]
    require(len(methods) == 1, f"Cannot uniquely locate initializer for {symbol}")
    index, method = methods[0]
    body = CilMethodBody(CilMethodBodyReaderBytes(pe.get_data(method.Rva)))
    stack, writes, widths = [], {}, {}

    def write(destination, value, width):
        require(
            isinstance(destination, tuple) and destination not in writes,
            "Overlapping or invalid constant writes",
        )
        writes[destination], widths[destination] = value, width

    for instruction in body.instructions:
        op, value = instruction.opcode.name, instruction.operand
        if op in ("ldsflda", "stsfld"):
            token = value.value
            require(token >> 24 == 4, "Unsupported field token")
            address = (token & 0xFFFFFF, 0)
            if op == "ldsflda":
                stack.append(address)
            else:
                write(address, stack.pop(), 4)
        elif op in ("ldc.i4", "ldc.i4.s", "ldc.r8"):
            require(
                not isinstance(value, float) or math.isfinite(value),
                "Nonfinite conversion",
            )
            stack.append(value)
        elif op.startswith("ldc.i4."):
            stack.append(-1 if op.endswith(".m1") else int(op.rsplit(".", 1)[-1]))
        elif op == "add":
            right, left = stack.pop(), stack.pop()
            require(
                isinstance(left, tuple) and isinstance(right, int),
                "Unsupported initializer address arithmetic",
            )
            stack.append((left[0], left[1] + right))
        elif op in ("stind.i4", "stind.i1", "stind.r8"):
            value, destination = stack.pop(), stack.pop()
            write(destination, value, {"stind.i4": 4, "stind.i1": 1, "stind.r8": 8}[op])
        elif op == "ret":
            require(not stack, "Unbalanced initializer stack")
        else:
            raise ValueError(f"Unsupported initializer instruction {op} for {symbol}")
    fields = {f for f, _ in writes}
    require(len(fields) == 1 and not stack, f"Invalid initializer writes for {symbol}")
    field = fields.pop()
    fieldname = str(pe.net.mdtables.Field.rows[field - 1].Name)
    require(fieldname.endswith(f".{symbol}"), "Initializer targets unexpected field")
    return {offset: (v, widths[(f, offset)]) for (f, offset), v in writes.items()}, {
        "methodName": str(method.Name),
        "methodToken": f"0x{0x06000000 | index:08X}",
        "rva": method.Rva,
        "fieldName": fieldname,
        "assignments": len(writes),
    }


def monitor_records(pe):
    require(
        pe.FILE_HEADER.Machine == 0x14C,
        "Only the structurally validated x86 CLI table layout is supported",
    )
    fields = {r.Field.row_index: r.Rva for r in pe.net.mdtables.FieldRva.rows}
    evidence = []

    def text(pointer):
        require(
            isinstance(pointer, tuple) and pointer[1] == 0 and pointer[0] in fields,
            "Unsupported string pointer",
        )
        raw = pe.get_data(fields[pointer[0]], 65536)
        require(b"\0" in raw, "Unterminated catalog string")
        return raw.split(b"\0", 1)[0].decode("utf-8")

    def table(symbol, length_symbol, size, layout):
        writes, source = constant_writes(pe, symbol)
        lengths, length_source = constant_writes(pe, length_symbol)
        require(
            set(lengths) == {0} and lengths[0][1] == 4,
            "Invalid array length initializer",
        )
        count = lengths[0][0]
        require(
            isinstance(count, int) and 0 < count <= 100000, "Unsupported array length"
        )
        expected = {
            row * size + offset: width
            for row in range(count)
            for offset, width in layout.items()
        }
        require(
            {offset: v[1] for offset, v in writes.items()} == expected,
            f"Unsupported memory layout or incomplete coverage for {symbol}",
        )
        evidence.append(
            {
                **source,
                "lengthInitializer": length_source,
                "recordBytes": size,
                "records": count,
            }
        )
        return [
            {offset: writes[row * size + offset][0] for offset in layout}
            for row in range(count)
        ]

    parameters = table(
        "Parameters_Details_Array",
        "Parameters_Array_Length",
        32,
        {0: 4, 4: 4, 8: 8, 16: 8, 24: 4},
    )
    sets = table(
        "Parameters_Sets_Details_Array",
        "Parameters_Sets_Array_Length",
        16,
        {0: 4, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 12: 4},
    )
    profiles = table(
        "Car_Details_Array", "Cars_Array_Length", 16, {0: 4, 4: 4, 8: 4, 12: 4}
    )
    categories = table(
        "Cars_Categories_Array", "Categories_Array_Length", 8, {0: 4, 4: 4}
    )
    parameters = [
        {
            "key": f"monitor:{i}",
            "sourceKey": "monitor",
            "parameterId": p[0],
            "category": str(p[4]),
            "name": text(p[24]),
            "multiply": str(p[8]),
            "offset": str(p[16]),
            "details": {"ordinal": i, "issues": []},
        }
        for i, p in enumerate(parameters)
    ]
    result_sets = []
    for s in sets:
        ids = text(s[12])
        require(
            re.fullmatch(r"[0-9]+(?:,[0-9]+)*,?", ids) is not None,
            "Unsupported parameter membership list",
        )
        result_sets.append(
            {
                "vendorId": s[0],
                "parameterIds": [int(v) for v in ids.split(",") if v],
                "details": {
                    "canBaudCode": s[4],
                    "isObdUnit": s[5],
                    "silentMode": s[6],
                    "obdProtocolsMask": s[7],
                    "regularProtocolsMask": s[8],
                    "rawParameterIds": ids,
                },
            }
        )
    return (
        parameters,
        result_sets,
        [
            {"vendorId": p[0], "setId": p[4], "categoryId": p[8], "name": text(p[12])}
            for p in profiles
        ],
        [{"vendorId": c[0], "name": text(c[4])} for c in categories],
        {
            "key": "monitor",
            "kind": "monitor",
            "evidence": {"initializers": evidence, "layout": "x86-constant-arrays-v1"},
        },
    )


def reconcile(catalog):
    issues, mappings = [], []
    by_id, membership = defaultdict(list), defaultdict(list)
    for parameter_set in catalog["sets"]:
        for parameter_id in parameter_set["parameterIds"]:
            membership[parameter_id].append(parameter_set["vendorId"])
    for p in catalog["parameters"]:
        by_id[p["parameterId"]].append(p)
        issues.extend(
            {"kind": issue, "parameterKey": p["key"]}
            for issue in p["details"]["issues"]
        )
    for parameter_id in sorted(set(by_id) | set(membership)):
        records = by_id[parameter_id]
        monitor = [p for p in records if p["sourceKey"] == "monitor"]
        workbook = [p for p in records if p["sourceKey"] != "monitor"]
        mappings.append(
            {
                "parameterId": parameter_id,
                "monitorCandidates": [
                    {"key": p["key"], "category": p["category"]} for p in monitor
                ],
                "workbookCandidates": [
                    {"key": p["key"], "category": p["category"]} for p in workbook
                ],
                "setIds": membership[parameter_id],
                "matchBasis": "id_only",
                "deviceSupport": "unverified",
                "karmaMapping": "unverified",
            }
        )
        if not monitor and membership[parameter_id]:
            issues.append(
                {
                    "kind": "set_member_without_monitor_definition",
                    "parameterId": parameter_id,
                    "setIds": membership[parameter_id],
                }
            )
        if not monitor or not workbook:
            issues.append(
                {
                    "kind": "source_coverage_difference",
                    "parameterId": parameter_id,
                    "missing": "monitor" if not monitor else "workbook",
                }
            )
    for key in ("sets", "profiles", "categories"):
        ids = [v["vendorId"] for v in catalog[key]]
        require(len(ids) == len(set(ids)), f"Duplicate {key} IDs")
    sets, categories = {v["vendorId"] for v in catalog["sets"]}, {
        v["vendorId"] for v in catalog["categories"]
    }
    require(
        all(
            p["setId"] in sets and p["categoryId"] in categories
            for p in catalog["profiles"]
        ),
        "Unresolved profile references",
    )
    catalog["mappings"], catalog["issues"] = mappings, issues
    catalog["coverage"] = {
        "complete": True,
        "sources": len(catalog["sources"]),
        "parameters": len(catalog["parameters"]),
        "sets": len(sets),
        "memberships": sum(len(s["parameterIds"]) for s in catalog["sets"]),
        "profiles": len(catalog["profiles"]),
        "categories": len(categories),
        "issues": dict(sorted(Counter(v["kind"] for v in issues).items())),
    }


def extract(path, label):
    pe, source, workbooks = inventory(path)
    parameters, sets, profiles, categories, monitor_source = monitor_records(pe)
    catalog = {
        "schemaVersion": SCHEMA_VERSION,
        "extractorVersion": EXTRACTOR_VERSION,
        "packageLabel": label,
        "source": source,
        "sources": [monitor_source],
        "parameters": parameters,
        "sets": sets,
        "profiles": profiles,
        "categories": categories,
    }
    for workbook in workbooks:
        source, records = workbook_records(workbook)
        catalog["sources"].append(source)
        catalog["parameters"].extend(records)
    reconcile(catalog)
    return catalog


def semantic_records(catalog):
    source_names = {
        s["key"]: sorted(
            v["path"]
            for v in s["evidence"].get("locations", [])
            if v["kind"] == "resource"
        )
        for s in catalog["sources"]
    }
    result, grouped = {}, defaultdict(list)
    for p in catalog["parameters"]:
        origin = (
            "monitor"
            if p["sourceKey"] == "monitor"
            else json.dumps(source_names[p["sourceKey"]] or [p["sourceKey"]])
        )
        grouped[(origin, p["category"], p["parameterId"])].append(p)
    for identity, records in grouped.items():
        values = []
        for p in records:
            formulas = {}
            for column, cell in p["details"].get("cells", {}).items():
                if "formula" not in cell:
                    continue
                formula = cell["formula"]
                anchor = formula.get(
                    "sharedAnchor", {"cell": cell["address"], "text": formula["text"]}
                )
                expression = anchor["text"]
                origin_row = re.search(r"[0-9]+$", anchor["cell"])[0]
                if expression == f"DEC2HEX(A{origin_row})":
                    expression = "DEC2HEX(parameterId)"
                formulas[column] = expression
            values.append(
                {
                    "name": p["name"],
                    "multiply": p["multiply"],
                    "offset": p["offset"],
                    "sourceHex": p["details"].get("sourceHex"),
                    "issues": p["details"]["issues"],
                    "formulas": formulas,
                }
            )
        result[json.dumps(["parameter", *identity])] = {
            "value": sorted(values, key=canonical),
            "records": records,
        }
    for kind in ("sets", "profiles", "categories"):
        for row in catalog[kind]:
            result[json.dumps([kind, row["vendorId"]])] = {
                "value": row,
                "records": [row],
            }
    return result


def compare(before, after):
    old, new = semantic_records(before), semantic_records(after)
    return {
        "before": before["source"]["sha256"],
        "after": after["source"]["sha256"],
        "added": [
            {"identity": k, "after": new[k]} for k in sorted(new.keys() - old.keys())
        ],
        "removed": [
            {"identity": k, "before": old[k]} for k in sorted(old.keys() - new.keys())
        ],
        "changed": [
            {"identity": k, "before": old[k], "after": new[k]}
            for k in sorted(old.keys() & new.keys())
            if old[k]["value"] != new[k]["value"]
        ],
        "sourceRecords": {"before": before["source"], "after": after["source"]},
        "issuesBefore": before["issues"],
        "issuesAfter": after["issues"],
    }


def markdown(catalog):
    lines = [
        f"# Simple eData Monitor catalog {catalog['packageLabel']}",
        "",
        f"Source: `{catalog['source']['fileName']}`; SHA-256 `{catalog['source']['sha256']}`.",
        "",
        f"Extractor {catalog['extractorVersion']}; schema {catalog['schemaVersion']}. The EXE was inspected statically and never executed.",
        "",
        "[Complete source records and mappings](catalog.json). [Regeneration procedure](../README.md).",
        "",
        "## Coverage",
        "",
        "| Source | Category/sheet | Records |",
        "| --- | --- | ---: |",
    ]
    for source in catalog["sources"]:
        if source["kind"] == "workbook":
            locations = (
                ", ".join(
                    v["path"]
                    for v in source["evidence"]["locations"]
                    if v["kind"] == "resource"
                )
                or source["key"]
            )
            lines.extend(
                f"| {locations} | {sheet['name']} | {sheet['rows']} |"
                for sheet in source["evidence"]["sheets"]
            )
        else:
            lines.extend(
                f"| Monitor | {category} | {count} |"
                for category, count in sorted(
                    Counter(
                        p["category"]
                        for p in catalog["parameters"]
                        if p["sourceKey"] == "monitor"
                    ).items()
                )
            )
    lines += [
        "",
        f"Parameter sets: {len(catalog['sets'])}; profiles: {len(catalog['profiles'])}; categories: {len(catalog['categories'])}.",
        "",
        "## Profiles",
        "",
        "| ID | Name | Set | Category |",
        "| --- | --- | --- | --- |",
    ]
    lines.extend(
        f"| {p['vendorId']} | {p['name']} | {p['setId']} | {p['categoryId']} |"
        for p in catalog["profiles"]
    )
    lines += [
        "",
        "## Source qualifications",
        "",
        "- Both different workbooks are retained; their runtime purpose is unresolved. Identical archives are deduplicated by SHA-256 while every discovered location is retained.",
        "- IDs are not globally unique. Mappings contain candidates matched by ID only; category equivalence, Karma correspondence and device support are unverified.",
        "- Cached formula values and shared formula anchors are preserved, not recalculated. Decimal/hex disagreements are retained.",
        "- Display multipliers/offsets do not define CAN decoding or prove units. Profile labels and stored baud defaults are independent source facts.",
        "- This is a vendor catalog, not device configuration, firmware detection or evidence of live measurements. No device commands are generated.",
        "",
        "## Issues",
        "",
    ]
    lines.extend(
        f"- `{kind}`: {count}." for kind, count in catalog["coverage"]["issues"].items()
    )
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("inspect", "extract"):
        cmd = sub.add_parser(command)
        cmd.add_argument("exe", type=Path)
        if command == "extract":
            cmd.add_argument("--label", required=True)
            cmd.add_argument("--out", type=Path, required=True)
    cmd = sub.add_parser("diff")
    cmd.add_argument("before", type=Path)
    cmd.add_argument("after", type=Path)
    cmd.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "inspect":
        pe, source, workbooks = inventory(args.exe)
        parameters, sets, profiles, categories, monitor = monitor_records(pe)
        summaries = []
        for workbook in workbooks:
            source_record, records = workbook_records(workbook)
            summaries.append({**source_record, "parameters": len(records)})
        print(
            json.dumps(
                {
                    "source": source,
                    "workbooks": summaries,
                    "monitor": monitor,
                    "counts": {
                        "parameters": len(parameters),
                        "sets": len(sets),
                        "profiles": len(profiles),
                        "categories": len(categories),
                    },
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    elif args.command == "extract":
        require(
            not args.out.exists(),
            "Output directory already exists; use a fresh directory",
        )
        catalog = extract(args.exe, args.label)
        raw = args.exe.read_bytes()
        require(
            sha256(raw) == catalog["source"]["sha256"], "EXE changed during extraction"
        )
        args.out.mkdir(parents=True)
        (args.out / "workbooks").mkdir()
        for source in catalog["sources"]:
            if source["kind"] == "workbook":
                location = source["evidence"]["locations"][0]
                payload = raw[
                    location["offset"] : location["offset"] + location["bytes"]
                ]
                require(
                    sha256(payload) == source["key"],
                    "Workbook source location does not match its hash",
                )
                (args.out / "workbooks" / f"{source['key']}.xlsx").write_bytes(payload)
        (args.out / "catalog.json").write_bytes(canonical(catalog) + b"\n")
        (args.out / "README.md").write_text(
            markdown(catalog), encoding="utf-8", newline="\n"
        )
        (args.out / "run.json").write_text(
            json.dumps(
                {
                    "analyzedAtUtc": datetime.now(timezone.utc).isoformat(),
                    "contentSha256": sha256(canonical(catalog)),
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(
            json.dumps(
                {
                    "contentSha256": sha256(canonical(catalog)),
                    "coverage": catalog["coverage"],
                },
                indent=2,
            )
        )
    else:
        before, after = json.loads(args.before.read_text(encoding="utf-8")), json.loads(
            args.after.read_text(encoding="utf-8")
        )
        report = compare(before, after)
        with args.out.open("x", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        print(
            json.dumps(
                {kind: len(report[kind]) for kind in ("added", "removed", "changed")}
            )
        )


if __name__ == "__main__":
    try:
        main()
    except (
        ValueError,
        OSError,
        KeyError,
        IndexError,
        ET.ParseError,
        zipfile.BadZipFile,
        struct.error,
        PEFormatError,
        zlib.error,
    ) as error:
        print(f"Catalog extraction failed: {error}", file=sys.stderr)
        sys.exit(1)
