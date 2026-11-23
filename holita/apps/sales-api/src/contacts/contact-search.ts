import type { Prisma } from '../generated/prisma/client.js';
import { contactPhoneFragment } from './contact-phone.js';

export function searchText(word: string) {
  return { contains: word.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const };
}

export function contactWordMatches(word: string): Prisma.LeadContactWhereInput[] {
  const match = searchText(word);
  const digits = contactPhoneFragment(word);
  return [{ name: match }, { email: match }, { phone: digits ? { contains: digits } : match }];
}
