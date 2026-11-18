export function tokenPrefix(): string {
  const prefix = process.env.CORE_TOKEN_PREFIX ?? 'osnova';
  if (!/^[a-z0-9-]+$/.test(prefix)) {
    throw new Error('CORE_TOKEN_PREFIX must contain lowercase letters, digits or hyphens.');
  }
  return prefix;
}
