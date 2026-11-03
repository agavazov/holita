export function ermRole(): 'all' | 'gateway' | 'api' {
  const role = process.env.ERM_ROLE ?? 'all';
  if (role !== 'all' && role !== 'gateway' && role !== 'api') {
    throw new Error('ERM_ROLE must be all, gateway or api.');
  }
  return role;
}
