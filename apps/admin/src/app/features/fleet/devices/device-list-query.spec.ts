import { convertToParamMap } from '@angular/router';
import {
  readDeviceListQuery,
  deviceListQueryParams,
  deviceListVariables,
} from './device-list-query';

describe('Device list URL', () => {
  it('normalizes unsupported paging/sorting and bounds the search', () => {
    expect(
      readDeviceListQuery(
        convertToParamMap({ page: '-1', pageSize: '7', sort: 'active', search: ' A\u0000 ' }),
      ),
    ).toEqual({ page: 1, pageSize: 20, sort: 'CREATED_AT', order: 'DESC', search: 'A' });
  });
  it('round-trips paging, plate sort and combined search through generated variables', () => {
    const query = readDeviceListQuery(
      convertToParamMap({
        page: '3',
        pageSize: '10',
        sort: 'imei',
        order: 'desc',
        search: 'CA',
      }),
    );
    expect(readDeviceListQuery(convertToParamMap(deviceListQueryParams(query)))).toEqual(query);
    expect(deviceListVariables(query)).toEqual({
      offset: 20,
      limit: 10,
      search: 'CA',
      sort: { field: 'IMEI', direction: 'DESC' },
    });
  });
});
