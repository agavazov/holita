import type { LeadStage } from '../generated/prisma/client.js';

export const closedLeadStages: readonly LeadStage[] = ['NOT_INTERESTED', 'WON', 'LOST'];
