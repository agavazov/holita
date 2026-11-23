import type {
  LeadContactRole,
  SalesLeadContactFieldsFragment,
} from '../generated/contacts-operations';
import bg from './bg.json';
import en from './en.json';

export const contactStrings = { bg, en };

export function contactRoleLabels(text: typeof en): Record<LeadContactRole, string> {
  return {
    OWNER: text.contactRoleOwner,
    MANAGER: text.contactRoleManager,
    EMPLOYEE: text.contactRoleEmployee,
    TECHNICAL: text.contactRoleTechnical,
    UNKNOWN: text.contactRoleUnknown,
  };
}

export function contactLabel(
  contact: Pick<SalesLeadContactFieldsFragment, 'name' | 'email' | 'phone'>,
  fallback: string,
): string {
  return contact.name ?? contact.email ?? contact.phone ?? fallback;
}
