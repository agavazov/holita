import { createServer } from 'node:http';

// Deterministic upstream for federation/browser checks; never uses a live Karma account.
export async function createKarmaFixture() {
  const cars = [
    {
      car_id: 41,
      device_id: '000123456789012',
      project_id: 12,
      car_number: 'KARMA TEST 41',
      car_type: 'Truck',
      car_year: '2020',
      car_color: 'White',
    },
  ];
  let empty = false;
  let failed = false;
  let session = 0;
  const requests: { method: string; path: string }[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    requests.push({ method: request.method ?? '', path: url.pathname });
    response.setHeader('content-type', 'application/json');
    request.resume();
    if (failed) {
      response.writeHead(503);
      response.end(JSON.stringify({ error: 'Fixture unavailable' }));
      return;
    }
    if (url.pathname === '/apiv2/login' && request.method === 'POST') {
      session++;
      response.end(JSON.stringify({ session_id: `fixture-session-${String(session)}` }));
    } else if (url.pathname === '/apiv2/cars' && request.method === 'GET') {
      response.end(
        JSON.stringify(
          url.searchParams.get('karma_sid') === `fixture-session-${String(session)}`
            ? empty
              ? []
              : cars
            : { error: 'Not logged in' },
        ),
      );
    } else {
      response.writeHead(404);
      response.end('{}');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing Karma fixture port');
  return {
    url: `http://127.0.0.1:${String(address.port)}/apiv2/`,
    requests,
    setEmpty: (value: boolean) => {
      empty = value;
    },
    setFailed: (value: boolean) => {
      failed = value;
    },
    expire: () => {
      session++;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        server.closeAllConnections();
      }),
  };
}
