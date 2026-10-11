import { convertToParamMap } from '@angular/router';
import {
  readVehicleListQuery,
  vehicleListQueryParams,
  vehicleListVariables,
} from './vehicle-list-query';

describe('Vehicle list URL', () => {
  it('normalizes unsupported paging/sorting and bounds the search', () => {
    expect(
      readVehicleListQuery(
        convertToParamMap({ page: '-1', pageSize: '7', sort: 'active', search: ' A\u0000 ' }),
      ),
    ).toEqual({ page: 1, pageSize: 20, sort: 'CREATED_AT', order: 'DESC', search: 'A' });
  });
  it('round-trips paging, plate sort and combined search through generated variables', () => {
    const query = readVehicleListQuery(
      convertToParamMap({
        page: '3',
        pageSize: '10',
        sort: 'licensePlate',
        order: 'desc',
        search: 'CA',
      }),
    );
    expect(readVehicleListQuery(convertToParamMap(vehicleListQueryParams(query)))).toEqual(query);
    expect(vehicleListVariables(query)).toEqual({
      offset: 20,
      limit: 10,
      search: 'CA',
      sort: { field: 'LICENSE_PLATE', direction: 'DESC' },
    });
  });
});
