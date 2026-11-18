export function ermRole(): 'all' | 'gateway' | 'api' | 'recovery' {
  const role = process.env.ERM_ROLE ?? 'all';
  if (role !== 'all' && role !== 'gateway' && role !== 'api' && role !== 'recovery') {
    throw new Error('ERM_ROLE must be all, gateway, api or recovery.');
  }
  return role;
}
