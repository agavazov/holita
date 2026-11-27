export const checkoutAddressFields = [
  { name: 'city', label: 'city', autocomplete: 'address-level2', maxLength: 120 },
  { name: 'postalCode', label: 'postalCode', autocomplete: 'postal-code', maxLength: 20 },
  { name: 'line1', label: 'addressLine1', autocomplete: 'address-line1', maxLength: 200 },
  { name: 'line2', label: 'addressLine2', autocomplete: 'address-line2', maxLength: 200 },
] as const;
