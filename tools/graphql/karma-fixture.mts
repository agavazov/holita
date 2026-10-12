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
      sub_type: 'Trailer',
      time_zone: 8,
      driver_ids: [],
    },
  ];
  let accountsEmpty = false;
  const users = Array.from({ length: 120 }, (_, index) => ({
    user_id: 71 + index,
    user_name: `fixture-${String(index).padStart(3, '0')}`,
    active: 0,
    expire_date: null,
    role_id: 40,
    first_name: index === 0 ? '<b>Fixture name</b>' : 'Fixture',
    last_name: '',
    time_zone: 0,
    email: `fixture-${String(index)}@example.test`,
    project_id: 12,
    project_ids: [12, 0],
  }));
  const roles = [
    { role_id: 15, description: 'Partner' },
    { role_id: 20, description: 'Manager' },
    { role_id: 30, description: 'User' },
    { role_id: 40, description: 'Viewer' },
    { role_id: 50, description: 'Driver' },
  ];
  let empty = false;
  let failed = false;
  let session = 0;
  let locationCoordinates: { latitude: number | null; longitude: number | null } = {
    latitude: 0,
    longitude: 0,
  };
  let locationEmpty = false;
  let referencesFailed = false;
  const zones = Array.from({ length: 120 }, (_, id) => ({
    zone_id: id,
    zone_name: id === 8 ? 'Europe/Sofia' : `Fixture/Zone${String(id).padStart(3, '0')}`,
  }));
  const edata = Array.from({ length: 600 }, (_, index) => {
    const utc = new Date(Date.UTC(2026, 0, 1, 0, index))
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    return {
      car_id: 41,
      device_id: '000123456789012',
      carnumber: 'KARMA TEST 41',
      message_id: 3000000001 + index,
      edt: utc,
      edt_tz: new Date(Date.UTC(2026, 0, 1, 2, index)).toISOString().slice(0, 19).replace('T', ' '),
      pdt: utc,
      spd: 0,
      odo: 0,
      latitude: 0,
      longitude: 0,
      parameters: [
        { id: 99999, value: 0, desc: 'Unlisted fixture parameter' },
        { id: 1, value: 850, desc: 'Engine RPM [rpm]' },
      ],
    };
  });
  let historyEmpty = false;
  const trips = edata.slice(0, 120).map((row, index) => ({
    trip_id: 4000000001 + index,
    car_id: 41,
    car_number: 'KARMA TEST 41',
    device_id: row.device_id,
    driver_id: null,
    trip_active: index === 119 ? 1 : 0,
    start_message_id: row.message_id,
    start_date: row.edt,
    start_latitude: 0,
    start_longitude: 0,
    start_odo: 0,
    stop_message_id: index === 119 ? null : row.message_id + 1,
    stop_date: index === 119 ? null : row.edt,
    stop_latitude: index === 119 ? null : 0,
    stop_longitude: index === 119 ? null : 0,
    stop_odo: index === 119 ? null : 0,
    trip_duration: 0,
    trip_distance: 0,
    trip_duration_night: 0,
    trip_distance_night: 0,
    max_speed: 0,
    driving_score: 0,
    eco_score: 0,
  }));
  const events = edata.map((row) => ({
    car_id: 41,
    device_id: row.device_id,
    message_id: row.message_id,
    extra: '<b>Fixture event text</b>',
    edt: row.edt,
    eid: row.message_id % 2 === 0 ? 0 : 33,
    latitude: 0,
    longitude: 0,
    spd: 0,
    odo: 0,
    pdt: row.pdt,
    edt_tz: row.edt_tz,
  }));
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
    } else if (
      (url.pathname === '/apiv2/cars' || /^\/apiv2\/cars\/\d+$/.test(url.pathname)) &&
      request.method === 'GET'
    ) {
      response.end(
        JSON.stringify(
          url.searchParams.get('karma_sid') === `fixture-session-${String(session)}`
            ? empty
              ? []
              : url.pathname === '/apiv2/cars'
                ? cars
                : cars.filter((car) => String(car.car_id) === url.pathname.split('/').at(-1))
            : { error: 'Not logged in' },
        ),
      );
    } else if (
      ['/apiv2/users', '/apiv2/roles'].includes(url.pathname) &&
      request.method === 'GET'
    ) {
      response.end(
        JSON.stringify(
          url.searchParams.get('karma_sid') !== `fixture-session-${String(session)}`
            ? { error: 'Not logged in' }
            : accountsEmpty
              ? []
              : url.pathname === '/apiv2/users'
                ? users
                : roles,
        ),
      );
    } else if (url.pathname === '/apiv2/version' && request.method === 'GET') {
      response.end(JSON.stringify({ version: '2.26.1.1' }));
    } else if (
      ['/apiv2/projects', '/apiv2/time-zones', '/apiv2/location'].includes(url.pathname) &&
      request.method === 'GET'
    ) {
      let result: unknown;
      if (url.searchParams.get('karma_sid') !== `fixture-session-${String(session)}`)
        result = { error: 'Not logged in' };
      else if (url.pathname !== '/apiv2/location' && referencesFailed) {
        response.writeHead(503);
        result = { error: 'Reference fixture unavailable' };
      } else if (url.pathname === '/apiv2/projects')
        result = empty ? [] : [{ project_id: 12, name: 'Fixture project' }];
      else if (url.pathname === '/apiv2/time-zones') result = empty ? [] : zones;
      else if (url.searchParams.get('car') !== '41') result = { error: 'Car not found' };
      else if (locationEmpty || empty) result = [];
      else {
        const last = edata.at(-1);
        const row = {
          car_id: 41,
          carnumber: 'KARMA TEST 41',
          device_id: '000123456789012',
          message_id: last?.message_id ?? null,
          eid: 0,
          extra: '<b>Fixture plain text</b>',
          edt: last?.edt ?? null,
          ...locationCoordinates,
        };
        const selected: Record<string, unknown> = { ...row };
        for (const field of url.searchParams.getAll('fields[]')) {
          if (field === 'spd' || field === 'odo') selected[field] = 0;
          if (field === 'pdt') selected[field] = last?.pdt ?? null;
          if (field === 'edt_tz') selected[field] = last?.edt_tz ?? null;
        }
        result = [selected];
      }
      response.end(JSON.stringify(result));
    } else if (
      ['/apiv2/trips', '/apiv2/events', '/apiv2/driving-profile'].includes(url.pathname) &&
      request.method === 'GET'
    ) {
      let result: unknown;
      if (url.searchParams.get('karma_sid') !== `fixture-session-${String(session)}`)
        result = { error: 'Not logged in' };
      else if (url.searchParams.get('car') !== '41') result = { error: 'Car not found' };
      else if (empty || historyEmpty) result = [];
      else if (url.pathname === '/apiv2/driving-profile')
        result = [
          {
            car_id: 41,
            car_number: 'KARMA TEST 41',
            device_id: '000123456789012',
            score: Object.fromEntries(
              [
                'accelerations',
                'brakes',
                'speed_bumps',
                'bypassing',
                'roundabout',
                'lane_change',
                'turns',
                'off_road',
                'speed',
              ].map((name, index) => [name, { score: index % 2 === 0 ? null : 0, weight: 0 }]),
            ),
          },
        ];
      else if (url.pathname === '/apiv2/trips')
        result = trips
          .filter(
            (row) =>
              (!url.searchParams.has('to_id') ||
                row.trip_id <= Number(url.searchParams.get('to_id'))) &&
              (!url.searchParams.has('from_date') ||
                row.start_date >= (url.searchParams.get('from_date') ?? '')) &&
              (!url.searchParams.has('to_date') ||
                row.start_date <= (url.searchParams.get('to_date') ?? '')),
          )
          .slice(-500);
      else
        result = events
          .filter(
            (row) =>
              (!url.searchParams.has('to_id') ||
                row.message_id <= Number(url.searchParams.get('to_id'))) &&
              (!url.searchParams.has('from_date') ||
                row.edt >= (url.searchParams.get('from_date') ?? '')) &&
              (!url.searchParams.has('to_date') ||
                row.edt <= (url.searchParams.get('to_date') ?? '')) &&
              (!url.searchParams.has('event_type[]') ||
                url.searchParams.getAll('event_type[]').includes(String(row.eid))),
          )
          .slice(-500);
      response.end(JSON.stringify(result));
    } else if (url.pathname === '/apiv2/edata' && request.method === 'GET') {
      const parameters = url.searchParams.getAll('parameter_id[]');
      const rows = edata
        .filter(
          (row) =>
            String(row.car_id) === url.searchParams.get('car') &&
            (!url.searchParams.has('to_id') ||
              row.message_id <= Number(url.searchParams.get('to_id'))) &&
            (!url.searchParams.has('from_date') ||
              row.edt >= (url.searchParams.get('from_date') ?? '')) &&
            (!url.searchParams.has('to_date') ||
              row.edt <= (url.searchParams.get('to_date') ?? '')),
        )
        .map((row) => ({
          ...row,
          parameters: row.parameters.filter(
            (parameter) => !parameters.length || parameters.includes(String(parameter.id)),
          ),
        }))
        .filter((row) => !parameters.length || row.parameters.length);
      response.end(
        JSON.stringify(
          url.searchParams.get('karma_sid') !== `fixture-session-${String(session)}`
            ? { error: 'Not logged in' }
            : url.searchParams.get('car') !== '41'
              ? { error: 'Car not found' }
              : empty
                ? []
                : rows.slice(-500),
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
    setAccountsEmpty: (value: boolean) => {
      accountsEmpty = value;
    },
    setHistoryEmpty: (value: boolean) => {
      historyEmpty = value;
    },
    setEmpty: (value: boolean) => {
      empty = value;
    },
    setFailed: (value: boolean) => {
      failed = value;
    },
    setLocationCoordinates: (latitude: number | null, longitude: number | null) => {
      locationCoordinates = { latitude, longitude };
    },
    setLocationEmpty: (value: boolean) => {
      locationEmpty = value;
    },
    setReferencesFailed: (value: boolean) => {
      referencesFailed = value;
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
