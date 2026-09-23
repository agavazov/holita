export function getTestDatabaseUrl(
  value = process.env.CORE_TEST_DATABASE_URL ??
    'postgresql://holita_core_test:holita_core_test_local@127.0.0.1:11084/holita_core_test',
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      'CORE_TEST_DATABASE_URL must use a valid URL for the dedicated local test database',
    );
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/holita_core_test' ||
    url.username !== 'holita_core_test' ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'CORE_TEST_DATABASE_URL must use the dedicated local holita_core_test database and role without URL options',
    );
  }
  return url.toString();
}
