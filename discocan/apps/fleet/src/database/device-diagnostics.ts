import type { DeviceDiagnosticStatus } from '@discocan/device-contract';

// Earlier imports recorded the fault-logger verdict in the details text alone.
export const legacyFaultReport = 419;
export const legacyFaultPrefix = 'eData 419:';
export const legacyFaultRemovedText = 'logger deleted';

type StoredDiagnostic = {
  diagnosticReport: number | null;
  diagnosticStatus: number | null;
  details: string | null;
};

export function storedDiagnosticReport(
  event: Pick<StoredDiagnostic, 'diagnosticReport' | 'details'>,
): number | null {
  return (
    event.diagnosticReport ??
    (event.details?.startsWith(legacyFaultPrefix) ? legacyFaultReport : null)
  );
}

export function storedDiagnosticStatus(
  event: Pick<StoredDiagnostic, 'diagnosticStatus' | 'details'>,
): DeviceDiagnosticStatus | null {
  if (event.diagnosticStatus === 1 || event.diagnosticStatus === 2) {
    return event.diagnosticStatus === 1 ? 'ADDED' : 'DELETED';
  }
  if (event.details?.startsWith(legacyFaultPrefix)) {
    return event.details.includes(legacyFaultRemovedText) ? 'DELETED' : 'ADDED';
  }
  return null;
}
