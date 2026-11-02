import type {
  KarmaDiagnosticFault,
  KarmaDiagnosticReport,
  KarmaEvent,
} from '../../generated/graphql/types.js';

function instantUtc(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const instant = value.replace(' ', 'T') + '.000Z';
  const date = new Date(instant);
  return Number.isFinite(date.getTime()) && date.toISOString() === instant ? instant : null;
}

function faultStatus(statusHex: string): KarmaDiagnosticFault['status'] {
  return statusHex === '01' ? 'ADDED' : statusHex === '02' ? 'REMOVED' : 'UNKNOWN';
}

export function diagnosticReport(event: KarmaEvent): KarmaDiagnosticReport | null {
  const rawPayload = event.extra ?? '';
  const report: KarmaDiagnosticReport = {
    event,
    instantUtc: instantUtc(event.edt),
    family: 'UNKNOWN',
    reportCode: event.eventId,
    decoding: 'OPAQUE',
    rawPayload,
    payloadHex: null,
    faults: [],
    acknowledgement: null,
    communication: null,
  };
  if (event.eventId === '2' || event.eventId === '70') {
    report.family = event.eventId === '2' ? 'TRACKER_E2' : 'OBD_E70';
    // Preserve these independent StarLink event formats until an installed capture is verified.
    return report;
  }
  if (event.eventId !== '33') {
    return null;
  }
  const parts = rawPayload.split(',');
  if (parts[0] !== '19' || parts[1] !== '0') {
    return null;
  }
  const code = parts[2] ?? '';
  report.reportCode = code;
  if (code === '154') {
    report.family = 'SPECIAL_ACK';
    report.acknowledgement =
      parts.length === 4 && parts[3] === '0'
        ? 'NACK'
        : parts.length === 4 && parts[3] === '1'
          ? 'POSITIVE_ACK'
          : 'UNKNOWN';
    report.decoding = report.acknowledgement === 'UNKNOWN' ? 'OPAQUE' : 'DECODED';
    return report;
  }
  switch (code) {
    case '411':
      report.family = 'EDATA_411';
      break;
    case '413':
      report.family = 'EDATA_413';
      break;
    case '417':
      report.family = 'EDATA_417';
      break;
    case '418':
      report.family = 'EDATA_418';
      break;
    case '419':
      report.family = 'EDATA_419';
      break;
    default:
      return null;
  }
  const payload = parts[7];
  if (
    parts.length !== 8 ||
    parts[3] !== '0' ||
    !/^[01]$/.test(parts[4] ?? '') ||
    !/^[1-9]\d*$/.test(parts[5] ?? '') ||
    !Number.isSafeInteger(Number(parts[5])) ||
    !/^\d{1,5}$/.test(parts[6] ?? '') ||
    Number(parts[6]) > 65535 ||
    payload === undefined ||
    !/^(?:[a-f\d]{2})*$/i.test(payload)
  ) {
    report.decoding = 'MALFORMED';
    return report;
  }
  const hex = payload.toUpperCase();
  report.payloadHex = hex;
  if (code === '418' || code === '417') {
    return report;
  }
  if (code === '411') {
    if (hex.length < 8) {
      report.decoding = 'MALFORMED';
      return report;
    }
    report.communication = {
      communicationMask: Number.parseInt(hex.slice(0, 2), 16),
      obdMask: Number.parseInt(hex.slice(2, 4), 16),
      canError: Number.parseInt(hex.slice(4, 6), 16),
      ignition: Number.parseInt(hex.slice(6, 8), 16),
      extensionHex: hex.slice(8),
    };
    report.decoding = 'DECODED';
    return report;
  }
  const width = code === '419' ? 12 : 6;
  if (!hex.startsWith(code === '419' ? '21' : '19') || (hex.length - 2) % width !== 0) {
    report.decoding = 'MALFORMED';
    return report;
  }
  if (hex.length === 2) {
    // A type byte alone has no verified empty-logger meaning.
    return report;
  }
  for (let offset = 2; offset < hex.length; offset += width) {
    const rawHex = hex.slice(offset, offset + width);
    const statusHex = rawHex.slice(-2);
    const fault: KarmaDiagnosticFault = { rawHex, statusHex, status: faultStatus(statusHex) };
    if (code === '419') {
      fault.spn = Number.parseInt(rawHex.slice(0, 8), 16);
      fault.fmi = Number.parseInt(rawHex.slice(8, 10), 16);
    } else {
      const first = Number.parseInt(rawHex.slice(0, 1), 16);
      fault.code = 'PCBU'.charAt(first >> 2) + String(first & 3) + rawHex.slice(1, 4);
    }
    report.faults.push(fault);
  }
  report.decoding = 'DECODED';
  return report;
}
