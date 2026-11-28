import { isEmail, isISO8601 } from 'class-validator';
import type { SalesOfferInput, SalesQuoteLineInput } from '../generated/graphql/types.js';
import { salesFieldError } from '../leads/lead-activity-input.js';

function text(value: string | null | undefined, field: string, maximum: number): string | null {
  const clean = value?.trim();
  if (clean?.includes('\u0000')) {
    throw salesFieldError(field, 'INVALID_VALUE', 'Text must not contain a null character');
  }
  if (clean && Array.from(clean).length > maximum) {
    throw salesFieldError(field, 'TOO_LONG', 'Text exceeds the maximum length');
  }
  return clean || null;
}

function email(input: SalesOfferInput, field: 'recipientEmail' | 'replyEmail'): string | null {
  const value = text(input[field], field, 254);
  if (value && !isEmail(value)) {
    throw salesFieldError(field, 'INVALID_FORMAT', 'Enter an email address');
  }
  return value;
}

function website(
  input: SalesOfferInput,
  field: 'currentSiteUrl' | 'proposedSiteUrl',
): string | null {
  const value = text(input[field], field, 2048);
  if (value && (!/^https?:\/\/[^/\s\\]/iu.test(value) || !URL.parse(value)?.hostname)) {
    throw salesFieldError(field, 'INVALID_FORMAT', 'Enter a complete HTTP or HTTPS website URL');
  }
  return value;
}

function count(input: SalesOfferInput, field: 'productCount' | 'categoryCount'): number | null {
  const value = input[field] ?? null;
  if (value !== null && value < 0) {
    throw salesFieldError(field, 'INVALID_VALUE', 'Enter a nonnegative count');
  }
  return value;
}

function quote(
  input: SalesQuoteLineInput | null | undefined,
  field: 'recommended' | 'alternative',
) {
  if (!input) {
    return { name: null, price: null };
  }
  const namePath = `${field}.planName`;
  const name = text(input.planName, namePath, 80);
  if (!name) {
    throw salesFieldError(namePath, 'REQUIRED', 'Enter a plan name');
  }
  const price = input.monthlyPrice.trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/u.test(price)) {
    throw salesFieldError(
      `${field}.monthlyPrice`,
      'INVALID_VALUE',
      'Enter a nonnegative monthly price with at most two decimal places',
    );
  }
  return { name, price };
}

export function offerFields(input: SalesOfferInput) {
  const validUntil = input.validUntil?.trim();
  if (
    validUntil &&
    (!/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(validUntil) || !isISO8601(validUntil, { strict: true }))
  ) {
    throw salesFieldError('validUntil', 'INVALID_FORMAT', 'Enter a calendar date');
  }
  const exampleDomain = text(input.exampleDomain, 'exampleDomain', 253);
  if (
    exampleDomain &&
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(
      exampleDomain,
    )
  ) {
    throw salesFieldError('exampleDomain', 'INVALID_FORMAT', 'Enter a domain such as shop.example');
  }

  const recommended = quote(input.recommended, 'recommended');
  const alternative = quote(input.alternative, 'alternative');
  return {
    recipientName: text(input.recipientName, 'recipientName', 255),
    recipientEmail: email(input, 'recipientEmail'),
    replyEmail: email(input, 'replyEmail'),
    replyPhone: text(input.replyPhone, 'replyPhone', 255),
    currentSiteUrl: website(input, 'currentSiteUrl'),
    proposedSiteUrl: website(input, 'proposedSiteUrl'),
    exampleDomain,
    validUntil: validUntil ? new Date(validUntil) : null,
    productCount: count(input, 'productCount'),
    categoryCount: count(input, 'categoryCount'),
    languages: text(input.languages, 'languages', 120),
    currentPlatform: text(input.currentPlatform, 'currentPlatform', 120),
    message: text(input.message, 'message', 700),
    includedScope: text(input.includedScope, 'includedScope', 4000),
    recommendedPlanName: recommended.name,
    recommendedMonthlyPrice: recommended.price,
    alternativePlanName: alternative.name,
    alternativeMonthlyPrice: alternative.price,
  };
}
