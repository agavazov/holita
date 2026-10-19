import { crc32, inflateRawSync } from 'node:zlib';
import { at, requireValue, sha256 } from './data.mjs';
import type { JsonObject, Workbook } from './data.mjs';

export function slice(data: Buffer, offset: number, bytes: number): Buffer {
  requireValue(
    Number.isSafeInteger(offset) &&
      Number.isSafeInteger(bytes) &&
      offset >= 0 &&
      bytes >= 0 &&
      offset + bytes <= data.length,
    'Truncated binary data',
  );
  return data.subarray(offset, offset + bytes);
}
export function u16(data: Buffer, offset: number): number {
  return slice(data, offset, 2).readUInt16LE();
}
export function u32(data: Buffer, offset: number): number {
  return slice(data, offset, 4).readUInt32LE();
}
export function utf8(data: Buffer): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(data);
}
export interface ZipEntry {
  path: string;
  data: Buffer;
}

export function zipEntries(payload: Buffer): ZipEntry[] {
  // Archive comments have variable lengths; locate the end record that ends at EOF.
  let eocd = -1;
  for (let i = Math.max(0, payload.length - 65557); i <= payload.length - 22; i++) {
    if (
      payload.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + u16(payload, i + 20) === payload.length
    ) {
      eocd = i;
    }
  }
  requireValue(eocd >= 0, 'Invalid ZIP end record');
  const count = u16(payload, eocd + 10),
    cdSize = u32(payload, eocd + 12),
    cdOffset = u32(payload, eocd + 16);
  requireValue(
    u16(payload, eocd + 4) === 0 &&
      u16(payload, eocd + 6) === 0 &&
      u16(payload, eocd + 8) === count,
    'Split ZIP is unsupported',
  );
  requireValue(
    count !== 65535 && cdSize !== 0xffffffff && cdOffset !== 0xffffffff,
    'ZIP64 is unsupported',
  );
  requireValue(count <= 10000 && cdOffset + cdSize === eocd, 'Invalid ZIP directory');
  const entries: ZipEntry[] = [],
    names = new Set<string>();
  let cursor = cdOffset,
    expanded = 0;
  for (let i = 0; i < count; i++) {
    requireValue(u32(payload, cursor) === 0x02014b50, 'Invalid ZIP directory entry');
    const flags = u16(payload, cursor + 8),
      method = u16(payload, cursor + 10),
      crc = u32(payload, cursor + 16);
    const compressed = u32(payload, cursor + 20),
      size = u32(payload, cursor + 24);
    const nameSize = u16(payload, cursor + 28),
      extraSize = u16(payload, cursor + 30),
      commentSize = u16(payload, cursor + 32),
      local = u32(payload, cursor + 42);
    requireValue(!(flags & 1), 'Encrypted workbook');
    requireValue(
      compressed !== 0xffffffff && size !== 0xffffffff && local !== 0xffffffff,
      'ZIP64 is unsupported',
    );
    requireValue(u16(payload, cursor + 34) === 0, 'Split ZIP is unsupported');
    const nameBytes = slice(payload, cursor + 46, nameSize);
    requireValue(
      (flags & 0x800) !== 0 || nameBytes.every((byte) => byte < 128),
      'Unsupported ZIP filename encoding',
    );
    const path = utf8(nameBytes);
    requireValue(!names.has(path), 'Duplicate ZIP entry names');
    names.add(path);
    expanded += size;
    requireValue(expanded <= 100_000_000, 'Oversized workbook');
    requireValue(u32(payload, local) === 0x04034b50, 'Invalid ZIP local entry');
    requireValue(
      u16(payload, local + 8) === method && u16(payload, local + 6) === flags,
      'ZIP header mismatch',
    );
    const localNameSize = u16(payload, local + 26),
      localExtraSize = u16(payload, local + 28);
    requireValue(
      slice(payload, local + 30, localNameSize).equals(nameBytes),
      'ZIP filename mismatch',
    );
    const start = local + 30 + localNameSize + localExtraSize;
    requireValue(start + compressed <= cdOffset, 'Invalid ZIP payload boundaries');
    const packed = slice(payload, start, compressed);
    requireValue(method === 0 || method === 8, 'Unsupported ZIP compression');
    const data =
      method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: Math.max(1, size) });
    requireValue(data.length === size && crc32(data) === crc, 'ZIP CRC failure');
    entries.push({ path, data });
    cursor += 46 + nameSize + extraSize + commentSize;
    requireValue(cursor <= eocd, 'Invalid ZIP directory bounds');
  }
  requireValue(cursor === eocd, 'Invalid ZIP directory size');
  return entries;
}
export function archiveCandidates(data: Buffer): { offset: number; payload: Buffer }[] {
  const result: { offset: number; payload: Buffer }[] = [];
  let cursor = 0;
  while ((cursor = data.indexOf(Buffer.from('504b0506', 'hex'), cursor)) >= 0) {
    const end = cursor;
    cursor += 4;
    requireValue(end + 22 <= data.length, 'Truncated ZIP end record');
    const count = u16(data, end + 10),
      size = u32(data, end + 12),
      offset = u32(data, end + 16);
    requireValue(
      u16(data, end + 4) === 0 && u16(data, end + 6) === 0 && u16(data, end + 8) === count,
      'Split ZIP is unsupported',
    );
    requireValue(
      count !== 65535 && size !== 0xffffffff && offset !== 0xffffffff,
      'ZIP64 is unsupported',
    );
    const first = end - size - offset,
      last = end + 22 + u16(data, end + 20);
    requireValue(first >= 0 && last <= data.length, 'Invalid ZIP boundaries');
    const payload = slice(data, first, last - first),
      names = zipEntries(payload).map((entry) => entry.path);
    if (names.includes('[Content_Types].xml') && names.includes('_rels/.rels')) {
      result.push({ offset: first, payload });
    }
  }
  return result;
}
interface Section {
  name: string;
  rva: number;
  virtualSize: number;
  offset: number;
  size: number;
}
export class PortableExecutable {
  readonly sections: Section[] = [];
  readonly machine: number;
  private readonly directories: number;
  private readonly directoryCount: number;
  constructor(readonly raw: Buffer) {
    requireValue(slice(raw, 0, 2).toString('ascii') === 'MZ', 'Invalid DOS header');
    const pe = u32(raw, 0x3c);
    requireValue(u32(raw, pe) === 0x4550, 'Invalid PE signature');
    this.machine = u16(raw, pe + 4);
    const optional = pe + 24,
      magic = u16(raw, optional),
      size = u16(raw, pe + 20);
    requireValue(magic === 0x10b || magic === 0x20b, 'Unsupported PE optional header');
    this.directoryCount = u32(raw, optional + (magic === 0x10b ? 92 : 108));
    this.directories = optional + (magic === 0x10b ? 96 : 112);
    requireValue(
      this.directoryCount <= 16 && this.directories + this.directoryCount * 8 <= optional + size,
      'Invalid PE directories',
    );
    for (let i = 0; i < u16(raw, pe + 6); i++) {
      const position = optional + size + i * 40;
      const section = {
        name: slice(raw, position, 8).toString('ascii').replace(/\0+$/, ''),
        virtualSize: u32(raw, position + 8),
        rva: u32(raw, position + 12),
        size: u32(raw, position + 16),
        offset: u32(raw, position + 20),
      };
      slice(raw, section.offset, section.size);
      this.sections.push(section);
    }
  }
  directory(index: number): { rva: number; size: number } {
    requireValue(index < this.directoryCount, 'Missing PE directory');
    return {
      rva: u32(this.raw, this.directories + index * 8),
      size: u32(this.raw, this.directories + index * 8 + 4),
    };
  }
  offset(rva: number, size = 1): number {
    const section = this.sections.find(
      (section) =>
        rva >= section.rva && rva < section.rva + Math.max(section.size, section.virtualSize),
    );
    requireValue(section && rva - section.rva + size <= section.size, 'Invalid/unbacked PE RVA');
    const offset = section.offset + rva - section.rva;
    slice(this.raw, offset, size);
    return offset;
  }
  data(rva: number, size: number): Buffer {
    return slice(this.raw, this.offset(rva, size), size);
  }
  available(rva: number, maximum: number): Buffer {
    const offset = this.offset(rva),
      section = this.sections.find(
        (section) => offset >= section.offset && offset < section.offset + section.size,
      );
    requireValue(section, 'Invalid PE RVA');
    return slice(this.raw, offset, Math.min(maximum, section.offset + section.size - offset));
  }
}
function versionStrings(data: Buffer): JsonObject[] {
  interface Version {
    key: string;
    value: string;
    children: Version[];
  }
  function read(start: number, limit: number): Version {
    const length = u16(data, start),
      valueLength = u16(data, start + 2),
      type = u16(data, start + 4),
      end = start + length;
    requireValue(length >= 6 && end <= limit, 'Invalid version resource');
    let cursor = start + 6;
    while (u16(data, cursor) !== 0) {
      cursor += 2;
    }
    const key = slice(data, start + 6, cursor - start - 6).toString('utf16le');
    cursor = (cursor + 2 + 3) & ~3;
    const valueBytes = valueLength * (type === 1 ? 2 : 1),
      value = slice(data, cursor, valueBytes).toString('utf16le').replace(/\0+$/, '');
    cursor = (cursor + valueBytes + 3) & ~3;
    const children: Version[] = [];
    while (cursor + 6 <= end) {
      const child = read(cursor, end);
      children.push(child);
      cursor = (cursor + u16(data, cursor) + 3) & ~3;
    }
    return { key, value, children };
  }
  const result: JsonObject[] = [];
  for (const info of read(0, data.length).children.filter(
    (child) => child.key === 'StringFileInfo',
  )) {
    for (const table of info.children) {
      result.push(Object.fromEntries(table.children.map((child) => [child.key, child.value])));
    }
  }
  return result;
}
export function resourceInventory(pe: PortableExecutable): {
  resources: JsonObject[];
  versions: JsonObject[];
  workbooks: Workbook[];
} {
  const resources: JsonObject[] = [],
    versions: JsonObject[] = [],
    books = new Map<string, Workbook>();
  function collect(data: Buffer, base: number, kind: string, path: string): number {
    const candidates = archiveCandidates(data);
    for (const candidate of candidates) {
      const key = sha256(candidate.payload),
        workbook = books.get(key) ?? { key, locations: [], payload: candidate.payload };
      const location = {
        kind,
        path,
        offset: base + candidate.offset,
        bytes: candidate.payload.length,
      };
      if (
        !workbook.locations.some(
          (item) =>
            item.kind === kind &&
            item.path === path &&
            item.offset === location.offset &&
            item.bytes === location.bytes,
        )
      ) {
        workbook.locations.push(location);
      }
      books.set(key, workbook);
    }
    return candidates.length;
  }
  const directory = pe.directory(2);
  if (directory.rva) {
    const base = pe.offset(directory.rva, directory.size),
      data = slice(pe.raw, base, directory.size),
      active = new Set<number>();
    function walk(offset: number, parts: string[]): void {
      requireValue(parts.length <= 16 && !active.has(offset), 'Cyclic/deep PE resource directory');
      active.add(offset);
      const count = u16(data, offset + 12) + u16(data, offset + 14);
      slice(data, offset + 16, count * 8);
      for (let i = 0; i < count; i++) {
        const position = offset + 16 + i * 8,
          name = u32(data, position),
          target = u32(data, position + 4);
        const identity =
          name & 0x80000000
            ? slice(data, (name & 0x7fffffff) + 2, u16(data, name & 0x7fffffff) * 2).toString(
                'utf16le',
              )
            : String(name);
        const names = [...parts, identity];
        if (target & 0x80000000) {
          walk(target & 0x7fffffff, names);
        } else {
          const rva = u32(data, target),
            size = u32(data, target + 4),
            payload = pe.data(rva, size),
            path = names.join('/'),
            fileOffset = pe.offset(rva, size);
          resources.push({ path, offset: fileOffset, bytes: size, sha256: sha256(payload) });
          requireValue(
            at(names, 0) !== 'EXCEL' || collect(payload, fileOffset, 'resource', path) > 0,
            'EXCEL resource has no supported workbook',
          );
          if (at(names, 0) !== 'EXCEL') {
            collect(payload, fileOffset, 'resource', path);
          }
          if (at(names, 0) === '16') {
            versions.push(...versionStrings(payload));
          }
        }
      }
      active.delete(offset);
    }
    walk(0, []);
  }
  for (const section of pe.sections) {
    collect(slice(pe.raw, section.offset, section.size), section.offset, 'section', section.name);
  }
  requireValue(books.size, 'No embedded workbook found; extraction coverage is incomplete');
  return {
    resources,
    versions,
    workbooks: [...books.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
}
