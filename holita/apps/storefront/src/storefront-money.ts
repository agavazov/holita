export const shopCurrency = 'EUR';

function isMoneyAmount(value: string): value is `${number}` {
  return /^\d+\.\d{2}$/.test(value);
}

export function formatStorefrontMoney(value: string, format: Intl.NumberFormat): string {
  return isMoneyAmount(value) ? format.format(value) : value;
}
