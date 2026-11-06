export interface NotificationExportScope {
  tenantId: string;
  branchId: string;
  deviceId: string;
  imei: string;
}

export interface NotificationExportCursor {
  eventId: string;
  commandCompletedAt: string | null;
  commandId: string | null;
}

export interface NotificationExportItem {
  sourceKind: 'DIAGNOSTIC' | 'ALARM' | 'COMMAND';
  sourceKey: string;
  sourceId: string;
  occurredAt: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  wordingKey: string;
  parameters: Record<string, string | null>;
  target: { kind: 'DEVICE'; id: string };
  recorded: boolean;
}

export interface NotificationExportPage {
  items: NotificationExportItem[];
  next: string;
  hasMore: boolean;
}
