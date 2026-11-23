function compactPhone(value: string): string {
  return value.replace(/[\s()-]/gu, '');
}

export function normalizeContactPhone(value: string): string | null {
  let phone = compactPhone(value);
  if (/^0[1-9]\d{7,8}$/u.test(phone)) {
    phone = '+359' + phone.slice(1);
  } else if (phone.startsWith('00')) {
    phone = '+' + phone.slice(2);
  } else if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }
  return /^\+[1-9]\d{7,14}$/u.test(phone) ? phone : null;
}

export function contactPhoneFragment(value: string): string | null {
  const phone = compactPhone(value);
  if (!/^\+?\d+$/u.test(phone)) {
    return null;
  }
  return phone.replace(/^(?:\+|00?)/u, '') || null;
}
