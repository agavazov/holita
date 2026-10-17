import { parseCatalog } from '../src/modules/edata-catalog/catalog-file.js';

export function catalogDocument() {
  return {
    schemaVersion: 1,
    extractorVersion: 'test-1',
    packageLabel: 'fixture',
    source: { sha256: 'a'.repeat(64), fileName: 'fixture.exe', bytes: 1 },
    sources: [
      { key: 'monitor', kind: 'monitor', evidence: {} },
      { key: 'workbook', kind: 'workbook', evidence: {} },
    ],
    parameters: [
      {
        key: 'monitor:0',
        sourceKey: 'monitor',
        parameterId: 1,
        category: '1',
        name: 'First',
        multiply: '0.125',
        offset: '0.0',
        details: { issues: [] },
      },
      {
        key: 'monitor:1',
        sourceKey: 'monitor',
        parameterId: 1,
        category: '2',
        name: 'Second category',
        multiply: '1.0',
        offset: '0.0',
        details: { issues: [] },
      },
      {
        key: 'workbook:0',
        sourceKey: 'workbook',
        parameterId: 1,
        category: 'FMS',
        name: 'Original',
        multiply: null,
        offset: null,
        details: { issues: ['decimal_hex_mismatch'], sourceHex: '2', calculatedHex: '1' },
      },
    ],
    sets: [
      {
        vendorId: 135,
        parameterIds: [1, 999, 1],
        details: {
          canBaudCode: 0,
          isObdUnit: 0,
          silentMode: 1,
          obdProtocolsMask: 0,
          regularProtocolsMask: 255,
          rawParameterIds: '1,999,1',
        },
      },
    ],
    categories: [{ vendorId: 3, name: 'FMS Trucks' }],
    profiles: [{ vendorId: 343, setId: 135, categoryId: 3, name: 'FMS Parameters (250k)' }],
    mappings: [{ parameterId: 1 }, { parameterId: 999 }],
    issues: [
      { kind: 'decimal_hex_mismatch', parameterKey: 'workbook:0' },
      { kind: 'set_member_without_monitor_definition', parameterId: 999 },
    ],
    coverage: {
      complete: true,
      sources: 2,
      parameters: 3,
      sets: 1,
      memberships: 3,
      categories: 1,
      profiles: 1,
      issues: { decimal_hex_mismatch: 1, set_member_without_monitor_definition: 1 },
    },
  };
}

export function catalogFixture() {
  return parseCatalog(Buffer.from(JSON.stringify(catalogDocument())));
}
