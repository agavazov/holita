import { convertToParamMap } from '@angular/router';
import {
  profileBackParams,
  profilePage,
  profilePageParams,
  profileTab,
} from './vehicle-profile-query';

describe('Vehicle profile URL state', () => {
  it('keeps independent table pages bounded while retaining the originating list query', () => {
    const params = convertToParamMap({
      search: 'Volvo',
      conditions: '[]',
      tripsPage: '4',
      tripsSize: '100',
      alertsPage: '-2',
      alertsSize: '101',
      servicePage: '999999999999999999999',
      serviceSize: '50',
    });
    expect(profilePage(params, 'trips')).toEqual({ page: 4, pageSize: 100 });
    expect(profilePage(params, 'alerts')).toEqual({ page: 1, pageSize: 20 });
    expect(profilePage(params, 'service')).toEqual({ page: 1, pageSize: 50 });
    expect(profileBackParams(params)).toEqual({ search: 'Volvo', conditions: '[]' });
  });

  it('uses native tab paths and removes default page parameters', () => {
    expect(profileTab('alerts')).toBe('alerts');
    expect(profileTab('unknown')).toBe('overview');
    expect(profilePageParams('trips', { page: 1, pageSize: 20 })).toEqual({
      tripsPage: null,
      tripsSize: null,
    });
  });
});
