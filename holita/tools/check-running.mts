import { config } from 'dotenv';

config({ path: 'holita/config/seed-accounts.env', quiet: true });
for (const [name, url] of [
  ['Admin', 'http://127.0.0.1:12000/'],
  ['Backoffice', 'http://127.0.0.1:12001/'],
  ['Sales', 'http://127.0.0.1:12002/'],
  ['Router', 'http://127.0.0.1:12016/health'],
] as const) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`${name} did not answer successfully`);
  }
  console.info(`${name} answered`);
}
const email = process.env.HOLITA_STAFF_EMAIL;
const password = process.env.HOLITA_STAFF_PASSWORD;
if (!email || !password) {
  throw new Error('Staff account configuration is required');
}
const response = await fetch('http://127.0.0.1:12010/graphql', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    query:
      'mutation($email:String!,$password:String!){signIn(email:$email,password:$password){user{role} tenant{name}}}',
    variables: { email, password },
  }),
  signal: AbortSignal.timeout(10000),
});
const body: unknown = await response.json();
if (
  !response.ok ||
  typeof body !== 'object' ||
  body === null ||
  !('data' in body) ||
  typeof body.data !== 'object' ||
  body.data === null ||
  !('signIn' in body.data) ||
  typeof body.data.signIn !== 'object' ||
  body.data.signIn === null ||
  !('user' in body.data.signIn) ||
  typeof body.data.signIn.user !== 'object' ||
  body.data.signIn.user === null ||
  !('role' in body.data.signIn.user) ||
  body.data.signIn.user.role !== 'ADMINISTRATOR'
) {
  throw new Error('Staff sign-in did not succeed');
}
console.info('Staff sign-in succeeded');
