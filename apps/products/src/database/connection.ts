export function getDatabaseUrl(): string {
  const value =
    process.env.PRODUCTS_DATABASE_URL ??
    'postgresql://holita_products:holita_products_local@127.0.0.1:11084/holita_products';
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error('PRODUCTS_DATABASE_URL must be a valid PostgreSQL URL');
  }
  return value;
}
