export function getTestDatabaseUrl(
  value = process.env.CORE_TEST_DATABASE_URL ??
    'postgresql://osnova_core_test:osnova_core_test_local@127.0.0.1:11084/osnova_core_test',
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
    !/^\/[a-z0-9]+_core_test$/.test(url.pathname) ||
    url.username !== url.pathname.slice(1) ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'CORE_TEST_DATABASE_URL must use the dedicated local product Core test database and role without URL options',
    );
  }
  return url.toString();
}
