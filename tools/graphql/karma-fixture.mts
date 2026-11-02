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
  let failed = false;
  let session = 0;
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
  const historicalTrips = edata.slice(0, 120).map((row, index) => ({
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
  const sourceToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const previousDay = new Date(`${sourceToday}T00:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const reportDay = previousDay.toISOString().slice(0, 10);
  const reportOffsetHours =
    Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Sofia',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(`${reportDay}T12:00:00Z`)),
    ) - 12;
  const trips = [
    ...historicalTrips,
    ...historicalTrips.slice(0, 2).map((row, index) => ({
      ...row,
      trip_id: 4000000121 + index,
      start_message_id: 5000000001 + index * 5,
      stop_message_id: 5000000005 + index * 5,
      start_date: `${reportDay} ${index === 0 ? '08:00:00' : '10:00:00'}`,
      stop_date: `${reportDay} ${index === 0 ? '09:00:00' : '11:00:00'}`,
      trip_duration: 60,
      trip_distance: 10 + index,
      trip_distance_night: 2,
      max_speed: 50 + index,
    })),
  ];
  const historicalEvents = edata.map((row) => ({
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
  const events = [
    ...historicalEvents,
    ...trips.slice(-2).flatMap((trip) =>
      Array.from({ length: 5 }, (_, index) => {
        const local = new Date(trip.start_date.replace(' ', 'T') + 'Z');
        local.setUTCMinutes(local.getUTCMinutes() + index * 15);
        const utc = new Date(local.getTime() - reportOffsetHours * 3600000);
        return {
          car_id: trip.car_id,
          device_id: trip.device_id,
          message_id: trip.start_message_id + index,
          extra: 'Synthetic position sample',
          edt: utc.toISOString().slice(0, 19).replace('T', ' '),
          edt_tz: local.toISOString().slice(0, 19).replace('T', ' '),
          pdt: utc.toISOString().slice(0, 19).replace('T', ' '),
          eid: 0,
          latitude: index * 0.01,
          longitude: index === 2 ? null : index * 0.02,
          spd: index === 0 || index === 4 ? 0 : 35,
          odo: index,
        };
      }),
    ),
    // Actual captured wire payloads, with fixture-only vehicle identity.
    ...[
      {
        message_id: 7177124308,
        edt: '2026-10-28 18:54:31',
        extra: '19,0,419,0,1,1,1001,21000010F30701000004DF0B01',
      },
      {
        message_id: 7179721665,
        edt: '2026-10-29 12:54:06',
        extra: '19,0,419,0,1,1,1001,2100005CFE0F01',
      },
      { message_id: 7180175996, edt: '2026-10-29 14:57:52', extra: '19,0,154,0' },
      {
        message_id: 7180194143,
        edt: '2026-10-29 15:04:01',
        extra: '19,0,411,0,1,1,1001,00000001010C87',
      },
    ].map((row) => ({
      ...row,
      car_id: 41,
      device_id: '000123456789012',
      edt_tz: null,
      pdt: row.edt,
      eid: 33,
      latitude: 0,
      longitude: 0,
      spd: 0,
      odo: 0,
    })),
  ];
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
            ? url.pathname === '/apiv2/cars'
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
      if (url.searchParams.get('karma_sid') !== `fixture-session-${String(session)}`) {
        result = { error: 'Not logged in' };
      } else if (url.pathname === '/apiv2/projects') {
        result = [{ project_id: 12, name: 'Fixture project' }];
      } else if (url.pathname === '/apiv2/time-zones') {
        result = zones;
      } else if (url.searchParams.get('car') !== '41') {
        result = { error: 'Car not found' };
      } else {
        const last = edata.at(-1);
        const row = {
          car_id: 41,
          carnumber: 'KARMA TEST 41',
          device_id: '000123456789012',
          message_id: last?.message_id ?? null,
          eid: 0,
          extra: '<b>Fixture plain text</b>',
          edt: last?.edt ?? null,
          latitude: 0,
          longitude: 0,
        };
        const selected: Record<string, unknown> = { ...row };
        for (const field of url.searchParams.getAll('fields[]')) {
          if (field === 'spd' || field === 'odo') {
            selected[field] = 0;
          }
          if (field === 'pdt') {
            selected[field] = last?.pdt ?? null;
          }
          if (field === 'edt_tz') {
            selected[field] = last?.edt_tz ?? null;
          }
        }
        result = [selected];
      }
      response.end(JSON.stringify(result));
    } else if (
      ['/apiv2/trips', '/apiv2/events', '/apiv2/driving-profile'].includes(url.pathname) &&
      request.method === 'GET'
    ) {
      let result: unknown;
      if (url.searchParams.get('karma_sid') !== `fixture-session-${String(session)}`) {
        result = { error: 'Not logged in' };
      } else if (url.searchParams.get('car') !== '41') {
        result = { error: 'Car not found' };
      } else if (url.pathname === '/apiv2/driving-profile') {
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
      } else if (url.pathname === '/apiv2/trips') {
        result = trips
          .filter(
            (row) =>
              (!url.searchParams.has('from_id') ||
                row.trip_id >= Number(url.searchParams.get('from_id'))) &&
              (!url.searchParams.has('to_id') ||
                row.trip_id <= Number(url.searchParams.get('to_id'))) &&
              (!url.searchParams.has('from_date') ||
                row.start_date >= (url.searchParams.get('from_date') ?? '')) &&
              (!url.searchParams.has('to_date') ||
                row.start_date <= (url.searchParams.get('to_date') ?? '')),
          )
          .slice(-500);
      } else {
        result = events
          .filter(
            (row) =>
              (!url.searchParams.has('from_id') ||
                row.message_id >= Number(url.searchParams.get('from_id'))) &&
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
      }
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
  if (!address || typeof address === 'string') {
    throw new Error('Missing Karma fixture port');
  }
  return {
    url: `http://127.0.0.1:${String(address.port)}/apiv2/`,
    reportDay,
    requests,
    /** Restores the healthy upstream and forgets recorded requests, e.g. between browser tests. */
    reset: () => {
      failed = false;
      requests.length = 0;
    },
    setFailed: (value: boolean) => {
      failed = value;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        server.closeAllConnections();
      }),
  };
}
