// Simple eData 4.04 report layouts, with capture corrections from
// docs/discocan/erm-resources/edata-simple-protocol-v4.04/diagnostics-and-fault-reporting.md.
export function decodeEdata(fields: readonly string[]) {
  const reportType = fields[2];
  if (
    fields[0] !== '19' ||
    fields[1] !== '0' ||
    reportType === undefined ||
    !/^\d{3}$/.test(reportType) ||
    fields.length < 8
  ) {
    return undefined;
  }
  const type = Number(reportType);
  const data = fields.slice(7).join(',');
  const payload = fields[3] === '1' ? Buffer.from(data, 'latin1').toString('hex') : data;
  const report = { type, payload };
  if (fields[3] !== '0' && fields[3] !== '1') {
    return report;
  }
  if (type === 417) {
    return payload === '' ? { ...report, noCanMessages: true } : report;
  }
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(payload)) {
    return report;
  }
  const bytes = Buffer.from(payload, 'hex');
  const hex = (start: number, end: number) => payload.slice(start * 2, end * 2);
  switch (type) {
    case 401: {
      if (bytes[0] !== 0x07 || (bytes.length - 1) % 22 !== 0) {
        return report;
      }
      const parameters = [];
      for (let offset = 1; offset < bytes.length; offset += 22) {
        parameters.push({
          parameter: bytes.readUInt16BE(offset),
          headerId: bytes.readUInt32BE(offset + 2),
          startBit: bytes.readUInt8(offset + 6),
          bitCount: bytes.readUInt8(offset + 7),
          multiplier: bytes.readUInt16BE(offset + 8),
          divisor: bytes.readUInt16BE(offset + 10),
          offsetHex: hex(offset + 12, offset + 14),
          filterMask: bytes.readUInt16BE(offset + 14),
          filterValue: bytes.readUInt16BE(offset + 16),
          type: bytes.readUInt8(offset + 18),
          flags: bytes.readUInt8(offset + 19),
          intervalSeconds: bytes.readUInt16BE(offset + 20),
        });
      }
      return { ...report, parameters };
    }
    case 402: {
      if (bytes[0] !== 0x08) {
        return report;
      }
      const rules = [];
      for (let offset = 1; offset < bytes.length;) {
        if (offset + 9 > bytes.length) {
          return report;
        }
        const debounce = bytes.readUInt16BE(offset + 6);
        const dataLength = bytes.readUInt8(offset + 8);
        if (offset + 9 + dataLength > bytes.length) {
          return report;
        }
        rules.push({
          rule: bytes.readUInt16BE(offset),
          trueEventId: bytes.readUInt16BE(offset + 2),
          falseEventId: bytes.readUInt16BE(offset + 4),
          debounceMilliseconds: debounce & 0x7fff,
          activateDashboard: (debounce & 0x8000) !== 0,
          dataLength,
          data: hex(offset + 9, offset + 9 + dataLength),
        });
        offset += 9 + dataLength;
      }
      return { ...report, rules };
    }
    case 405: {
      if (bytes[0] !== 0x14) {
        return report;
      }
      const parameters = [];
      for (let offset = 1; offset < bytes.length;) {
        if (offset + 4 > bytes.length) {
          return report;
        }
        const valueSize = bytes.readUInt8(offset + 3);
        if (![1, 2, 4].includes(valueSize) || offset + 4 + valueSize > bytes.length) {
          return report;
        }
        // Signedness and physical conversion require the parameter definition; keep these bytes raw.
        parameters.push({
          parameter: bytes.readUInt16BE(offset),
          type: bytes.readUInt8(offset + 2),
          valueSize,
          valueHex: hex(offset + 4, offset + 4 + valueSize),
        });
        offset += 4 + valueSize;
      }
      return { ...report, parameters };
    }
    case 411:
      if (bytes.length < 4) {
        return report;
      }
      return {
        ...report,
        communicationMask: bytes.readUInt8(0),
        obdCommunicationMask: bytes.readUInt8(1),
        canError: bytes.readUInt8(2),
        ignition: bytes.readUInt8(3),
        extension: hex(4, bytes.length),
      };
    case 413: {
      if (bytes[0] !== 0x19 || (bytes.length - 1) % 3 !== 0) {
        return report;
      }
      const faults = [];
      for (let offset = 1; offset < bytes.length; offset += 3) {
        const code = bytes.readUInt16BE(offset);
        faults.push({
          code: `${'PCBU'.charAt(code >>> 14)}${String((code >>> 12) & 3)}${(code & 0x0fff).toString(16).toUpperCase().padStart(3, '0')}`,
          status: bytes.readUInt8(offset + 2),
        });
      }
      return { ...report, faults };
    }
    case 418: {
      if (bytes[0] !== 0x20 || (bytes.length - 1) % 6 !== 0) {
        return report;
      }
      const faults = [];
      for (let offset = 1; offset < bytes.length; offset += 6) {
        const code = bytes.subarray(offset, offset + 5);
        if (code.some((byte) => byte > 0x7f)) {
          return report;
        }
        faults.push({ code: code.toString('ascii'), status: bytes.readUInt8(offset + 5) });
      }
      return { ...report, faults };
    }
    case 419: {
      if (bytes[0] !== 0x21 || (bytes.length - 1) % 6 !== 0) {
        return report;
      }
      const faults = [];
      for (let offset = 1; offset < bytes.length; offset += 6) {
        // Real captures use four SPN bytes; reserved SPN/FMI bits remain uninterpreted.
        faults.push({
          spn: bytes.readUInt32BE(offset),
          fmi: bytes.readUInt8(offset + 4),
          status: bytes.readUInt8(offset + 5),
        });
      }
      return { ...report, faults };
    }
    default:
      return report;
  }
}

export type EdataReport = Exclude<ReturnType<typeof decodeEdata>, undefined>;
