import { searchApplies } from '@osnova/ui';

export function compactPhoneSearch(search: string): string {
  if (searchApplies(search)) {
    return search;
  }
  const compact = search.replace(/[\s()-]/gu, '');
  // Keep the country prefix entered by the user. Sales normalizes it when matching contacts.
  return /^(?:0[1-9]\d{7,8}|(?:\+|00)?[1-9]\d{7,14})$/u.test(compact) ? compact : search;
}
