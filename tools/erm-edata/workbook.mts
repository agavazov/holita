import { posix } from 'node:path';
import { EntityDecoder, XML } from '@nodable/entities';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { utf8, zipEntries } from './binary.mjs';
import { array, at, object, requireValue, sha256, string } from './data.mjs';
import type { JsonObject, Parameter, Workbook } from './data.mjs';

const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relationship = 'http://schemas.openxmlformats.org/package/2006/relationships';
const documentRelationship = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  text: string | null;
  children: XmlNode[];
}
function isXmlCharacter(code: number): boolean {
  return (
    [9, 10, 13].includes(code) ||
    (code >= 32 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}
export function xml(data: Buffer): XmlNode {
  const source = utf8(data);
  requireValue(!/<!DOCTYPE|<!ENTITY/i.test(source), 'DTD/entity XML is unsupported');
  for (const character of source) {
    requireValue(isXmlCharacter(character.codePointAt(0) ?? 0), 'Invalid XML character');
  }
  // The syntax validator does not resolve entities. Match ElementTree's strict
  // predefined/numeric entity handling without interpreting comments or CDATA.
  const entityText = source.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, '');
  for (const match of entityText.matchAll(/&([^;]*);/g)) {
    const entity = at(match, 1);
    if (['lt', 'gt', 'amp', 'quot', 'apos'].includes(entity)) {
      continue;
    }
    requireValue(/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity), 'Unsupported XML entity');
    const code = entity.startsWith('#x')
      ? Number.parseInt(entity.slice(2), 16)
      : Number(entity.slice(1));
    requireValue(isXmlCharacter(code), 'Invalid XML character entity');
  }
  try {
    SyntaxValidator.validate(source, {
      invalidCharSequence: { comment: true, tagValue: true, attrLt: true },
    });
  } catch {
    throw new Error('Malformed workbook XML');
  }
  const parsed: unknown = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    entityDecoder: new EntityDecoder({ namedEntities: XML, numericAllowed: true }),
  }).parse(source);
  function nodes(input: unknown, inherited: Record<string, string>): XmlNode[] {
    requireValue(Array.isArray(input), 'Unsupported XML structure');
    const result: XmlNode[] = [];
    for (const entry of input) {
      const item = object(entry),
        attributes = item[':@'] === undefined ? {} : object(item[':@']),
        namespaces = { ...inherited };
      for (const [key, value] of Object.entries(attributes)) {
        if (key === 'xmlns' || key.startsWith('xmlns:')) {
          namespaces[key === 'xmlns' ? '' : key.slice(6)] = string(value);
        }
      }
      function expanded(name: string, attribute = false): string {
        const colon = name.indexOf(':'),
          prefix = colon < 0 ? '' : name.slice(0, colon),
          local = colon < 0 ? name : name.slice(colon + 1);
        const uri = prefix ? namespaces[prefix] : attribute ? undefined : namespaces[''];
        requireValue(!prefix || uri !== undefined, 'Unbound XML namespace');
        return uri ? `{${uri}}${local}` : local;
      }
      for (const [name, children] of Object.entries(item)) {
        if (name === ':@' || name.startsWith('?') || name.startsWith('#')) {
          continue;
        }
        const content = array(children),
          texts: string[] = [];
        for (const child of content) {
          const value = object(child)['#text'];
          if (value !== undefined) {
            texts.push(string(value));
          }
        }
        const attrs: Record<string, string> = {};
        for (const [key, value] of Object.entries(attributes)) {
          if (key !== 'xmlns' && !key.startsWith('xmlns:')) {
            const name = expanded(key, true);
            requireValue(!Object.hasOwn(attrs, name), 'Duplicate expanded XML attribute');
            attrs[name] = string(value);
          }
        }
        result.push({
          name: expanded(name),
          attributes: attrs,
          text: texts.length ? texts.join('') : null,
          children: nodes(content, namespaces),
        });
      }
    }
    return result;
  }
  const roots = nodes(parsed, { xml: 'http://www.w3.org/XML/1998/namespace' });
  requireValue(roots.length === 1, 'Unsupported XML root');
  return at(roots, 0);
}
function children(node: XmlNode, name: string, namespace = spreadsheet): XmlNode[] {
  return node.children.filter((child) => child.name === `{${namespace}}${name}`);
}
function descendants(node: XmlNode, name: string): XmlNode[] {
  return node.children.flatMap((child) => [
    ...(child.name === `{${spreadsheet}}${name}` ? [child] : []),
    ...descendants(child, name),
  ]);
}
function attribute(node: XmlNode, name: string): string {
  const value = node.attributes[name];
  requireValue(value !== undefined, `Missing XML attribute ${name}`);
  return value;
}
interface Formula extends JsonObject {
  text: string | null;
  attributes: JsonObject;
  sharedAnchor?: JsonObject;
}
interface Cell extends JsonObject {
  address: string;
  type: string;
  raw: string | null;
  value: string | null;
  formula?: Formula;
}
type Cells = Record<string, Cell>;
export function workbookRecords(item: Workbook): { source: JsonObject; parameters: Parameter[] } {
  const entries = zipEntries(item.payload),
    files = new Map(entries.map((entry) => [entry.path, entry.data]));
  function read(path: string): XmlNode {
    const payload = files.get(path);
    requireValue(payload, `Missing workbook part ${path}`);
    return xml(payload);
  }
  const roots = read('_rels/.rels').children.filter((child) =>
    child.attributes['Type']?.endsWith('/officeDocument'),
  );
  requireValue(
    roots.length === 1 && at(roots, 0).attributes['TargetMode'] !== 'External',
    'Unsupported workbook root',
  );
  const main = attribute(at(roots, 0), 'Target').replace(/^\/+/, ''),
    parent = posix.dirname(main) === '.' ? '' : posix.dirname(main);
  const relPath = posix.join(parent, '_rels', `${posix.basename(main)}.rels`),
    targets = new Map<string, { kind: string; path: string }>();
  for (const rel of children(read(relPath), 'Relationship', relationship)) {
    requireValue(
      rel.attributes['TargetMode'] !== 'External',
      'External workbook relationship is unsupported',
    );
    const target = posix.normalize(
      posix.join(parent, attribute(rel, 'Target')).replace(/^\/+/, ''),
    );
    requireValue(!target.startsWith('../') && files.has(target), 'Invalid workbook relationship');
    targets.set(attribute(rel, 'Id'), {
      kind: attribute(rel, 'Type').split('/').pop() ?? '',
      path: target,
    });
  }
  const shared = [...targets.values()].filter((target) => target.kind === 'sharedStrings');
  requireValue(shared.length <= 1, 'Ambiguous shared strings');
  const strings = shared.length
    ? read(at(shared, 0).path).children.map((si) =>
        descendants(si, 't')
          .map((t) => t.text ?? '')
          .join(''),
      )
    : [];
  const parameters: Parameter[] = [],
    sheets: JsonObject[] = [];
  for (const sheet of children(read(main), 'sheets').flatMap((container) =>
    children(container, 'sheet'),
  )) {
    const name = attribute(sheet, 'name'),
      target = targets.get(attribute(sheet, `{${documentRelationship}}id`));
    requireValue(target?.kind === 'worksheet', 'Unsupported workbook sheet type');
    const rows: { number: number; cells: Cells }[] = [],
      anchors = new Map<string, JsonObject>();
    for (const row of children(read(target.path), 'sheetData').flatMap((container) =>
      children(container, 'row'),
    )) {
      const cells: Cells = {};
      for (const cell of children(row, 'c')) {
        const address = attribute(cell, 'r'),
          type = cell.attributes['t'] ?? 'n',
          match = /^([A-Z]+)[1-9][0-9]*$/.exec(address);
        requireValue(match, 'Invalid cell address');
        const valueNode = children(cell, 'v')[0],
          raw = valueNode ? (valueNode.text ?? '') : null;
        let value = raw;
        if (type === 's') {
          requireValue(
            raw !== null &&
              /^[+-]?\d+$/.test(raw) &&
              Number(raw) >= 0 &&
              Number(raw) < strings.length,
            'Invalid shared string index',
          );
          value = at(strings, Number(raw));
        } else if (type === 'inlineStr') {
          value = children(cell, 'is')
            .flatMap((container) => descendants(container, 't'))
            .map((t) => t.text ?? '')
            .join('');
        }
        const detail: Cell = { address, type, raw, value },
          formula = children(cell, 'f')[0];
        if (formula) {
          detail.formula = { text: formula.text, attributes: { ...formula.attributes } };
          if (formula.attributes['t'] === 'shared' && formula.text) {
            const key = attribute(formula, 'si');
            requireValue(!anchors.has(key), 'Duplicate shared formula anchor');
            anchors.set(key, {
              cell: address,
              text: formula.text,
              range: formula.attributes['ref'] ?? null,
            });
          }
        }
        cells[at(match, 1)] = detail;
      }
      const rowNumber = Number(attribute(row, 'r'));
      requireValue(Number.isSafeInteger(rowNumber) && rowNumber > 0, 'Invalid worksheet row');
      rows.push({ number: rowNumber, cells });
    }
    const headers = rows.filter((row) => row.cells['A']?.value === 'Parametr ID (Dec)');
    requireValue(headers.length === 1, `Unsupported headers in ${name}`);
    const header = at(headers, 0);
    requireValue(
      header.cells['B']?.value === 'Parametr ID (Hex)' &&
        header.cells['C']?.value === 'Parameter Name',
      `Unsupported column layout in ${name}`,
    );
    let count = 0;
    for (const row of rows) {
      const cells = row.cells;
      if (
        row.number <= header.number ||
        Object.values(cells).every((cell) => cell.value === null)
      ) {
        continue;
      }
      const decimal = cells['A']?.value,
        title = cells['C']?.value;
      requireValue(
        decimal !== null && decimal !== undefined && /^[0-9]+$/.test(decimal) && title,
        `Invalid parameter row ${name}:${String(row.number)}`,
      );
      const parameterId = Number(decimal);
      requireValue(parameterId <= 2147483647, 'Parameter ID exceeds supported integer range');
      for (const cell of Object.values(cells)) {
        const formula = cell.formula;
        if (formula?.attributes['t'] === 'shared') {
          const anchor = anchors.get(string(formula.attributes['si']));
          requireValue(anchor, 'Missing shared formula anchor');
          formula.sharedAnchor = anchor;
        }
      }
      const sourceHex = cells['B']?.value;
      requireValue(sourceHex && /^[0-9a-fA-F]+$/.test(sourceHex), 'Missing/invalid cached hex ID');
      const issues =
        BigInt(`0x${sourceHex}`) !== BigInt(parameterId) ? ['decimal_hex_mismatch'] : [];
      parameters.push({
        key: `workbook:${item.key}:${name}:${String(row.number)}`,
        sourceKey: item.key,
        parameterId,
        category: name,
        name: title,
        multiply: cells['D']?.value ?? null,
        offset: null,
        details: {
          row: row.number,
          xmlPath: target.path,
          cells,
          sourceHex,
          calculatedHex: parameterId.toString(16).toUpperCase(),
          issues,
        },
      });
      count++;
    }
    requireValue(count > 0, `Empty parameter sheet ${name}`);
    sheets.push({ name, path: target.path, rows: count, headers: header.cells });
  }
  return {
    source: {
      key: item.key,
      kind: 'workbook',
      evidence: {
        locations: item.locations,
        entries: entries.map((entry) => ({
          path: entry.path,
          bytes: entry.data.length,
          sha256: sha256(entry.data),
        })),
        sheets,
        runtimePurpose: 'unresolved',
      },
    },
    parameters,
  };
}
