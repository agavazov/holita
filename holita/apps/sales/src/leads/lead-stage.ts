import { toneSeverity, type StatusTone } from '@osnova/ui';
import type { LeadStage } from '../generated/leads-operations';
import { leadStrings } from './lead-strings';

export const leadStages = [
  'NEW',
  'APPROVED_FOR_CALL',
  'CALLED',
  'INTERESTED',
  'TRY_LATER',
  'NOT_INTERESTED',
  'WON',
  'LOST',
] as const satisfies readonly LeadStage[];

const stageTones: Record<LeadStage, StatusTone> = {
  NEW: 'accent',
  APPROVED_FOR_CALL: 'info',
  CALLED: 'info',
  INTERESTED: 'success',
  TRY_LATER: 'warn',
  NOT_INTERESTED: 'danger',
  WON: 'success',
  LOST: 'neutral',
};

export function leadStageOptions(language: keyof typeof leadStrings) {
  return leadStages.map((stage) => ({ value: stage, label: leadStrings[language].stages[stage] }));
}

export function leadStageSeverity(stage: LeadStage) {
  return toneSeverity(stageTones[stage]);
}
