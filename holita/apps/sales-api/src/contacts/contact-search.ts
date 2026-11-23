import type { Prisma } from '../generated/prisma/client.js';
import { contactPhoneFragment, normalizeContactPhone } from './contact-phone.js';

export function contactSearchWords(term: string): string[] {
  const words = term.split(/\s+/u).filter(Boolean);
  const phone = words.length > 5 ? normalizeContactPhone(term) : null;
  return phone ? [phone] : words;
}

export function searchText(word: string) {
  return { contains: word.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const };
}

export function contactWordMatches(word: string): Prisma.LeadContactWhereInput[] {
  const match = searchText(word);
  const digits = contactPhoneFragment(word);
  return [{ name: match }, { email: match }, { phone: digits ? { contains: digits } : match }];
}
