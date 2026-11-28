import { toneSeverity, type StatusTone } from '@osnova/ui';
import type { LeadTaskStatus } from '../generated/leads-operations';

const taskTones: Record<LeadTaskStatus, StatusTone> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function isOpenTask(status: LeadTaskStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}

export function leadTaskSeverity(status: LeadTaskStatus) {
  return toneSeverity(taskTones[status]);
}
