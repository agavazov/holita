export function getTestDatabaseUrl(
  value = process.env.PRODUCTS_TEST_DATABASE_URL ??
    'postgresql://holita_products_test:holita_products_test_local@127.0.0.1:11084/holita_products_test',
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      'PRODUCTS_TEST_DATABASE_URL must use a valid URL for the dedicated local test database',
    );
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/holita_products_test' ||
    url.username !== 'holita_products_test' ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'PRODUCTS_TEST_DATABASE_URL must use the dedicated local holita_products_test database and role without URL options',
    );
  }
  return url.toString();
}
