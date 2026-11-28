import { formatMoneyCents, toneSeverity, type Language } from '@osnova/ui';
import type { SalesOfferStatus, SalesOfferSummaryFragment } from '../generated/offers-operations';
import bg from './bg.json';
import en from './en.json';

export const offerStrings = { bg, en };
export const quoteKinds = ['recommended', 'alternative'] as const;
export type QuoteKind = (typeof quoteKinds)[number];

export const offerStatuses = ['DRAFT', 'PREPARED', 'MANUALLY_SENT'] as const;
export const offerStatusKeys = {
  DRAFT: 'draft',
  PREPARED: 'prepared',
  MANUALLY_SENT: 'manuallySent',
} as const satisfies Record<SalesOfferStatus, string>;

export function offerStatusLabel(status: SalesOfferStatus, language: Language): string {
  return offerStrings[language][offerStatusKeys[status]];
}

export function offerStatusSeverity(status: SalesOfferStatus) {
  return toneSeverity(
    ({ DRAFT: 'neutral', PREPARED: 'info', MANUALLY_SENT: 'success' } as const)[status],
  );
}

export function offerLabel(offer: SalesOfferSummaryFragment, fallback: string): string {
  return offer.recipientName ?? offer.recipientEmail ?? offer.currentSiteUrl ?? fallback;
}

export function offerPrice(price: string, language: Language): string {
  // The API returns a fixed two-decimal string. Convert it to whole cents for display.
  return formatMoneyCents(Number(price.replace('.', '')), language);
}

export const contactFields = [
  { key: 'recipientName', type: 'text' },
  { key: 'recipientEmail', type: 'email' },
  { key: 'replyEmail', type: 'email' },
  { key: 'replyPhone', type: 'tel' },
] as const;

export const siteFields = [
  { key: 'currentSiteUrl', type: 'url' },
  { key: 'proposedSiteUrl', type: 'url' },
  { key: 'exampleDomain', type: 'text' },
  { key: 'validUntil', type: 'date' },
  { key: 'productCount', type: 'number' },
  { key: 'categoryCount', type: 'number' },
  { key: 'languages', type: 'text' },
  { key: 'currentPlatform', type: 'text' },
] as const;

export const offerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
