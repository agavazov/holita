import type { ParamMap, Params } from '@angular/router';
import type {
  FleetProblemSort,
  FleetServiceTaskSort,
  FleetTripSort,
} from '../../../../generated/graphql/operations';
import type { ListQuery } from '../../../ui/list/list-query';
import { vehicleProfileTabs, type VehicleProfileTab } from './vehicle-profile-view';

export const profileListTabs = ['trips', 'problems', 'service'] as const;
export type ProfileListTab = (typeof profileListTabs)[number];
export interface ProfilePage {
  readonly page: number;
  readonly pageSize: number;
}
export type ProfileSort = NonNullable<ListQuery['sort']>;
export interface ProfileListQuery extends ProfilePage {
  readonly sort: ProfileSort;
}
const tripSorts: Readonly<Record<string, FleetTripSort['field']>> = {
  started: 'STARTED_AT',
  distance: 'DISTANCE_KM',
  duration: 'DURATION_SECONDS',
  score: 'DRIVING_SCORE',
};
const problemSorts: Readonly<Record<string, FleetProblemSort['field']>> = {
  observed: 'TIME',
  source: 'SOURCE',
  severity: 'SEVERITY',
  state: 'STATE',
};
const serviceSorts: Readonly<Record<string, FleetServiceTaskSort['field']>> = {
  task: 'TASK',
  due: 'DUE_ON',
  urgency: 'URGENCY',
  cost: 'COST_CENTS',
};
const sortFields: Readonly<Record<ProfileListTab, readonly string[]>> = {
  trips: Object.keys(tripSorts),
  problems: Object.keys(problemSorts),
  service: Object.keys(serviceSorts),
};
const defaultSorts: Readonly<Record<ProfileListTab, ProfileSort>> = {
  trips: { field: 'started', direction: 'desc' },
  problems: { field: 'observed', direction: 'desc' },
  service: { field: 'urgency', direction: 'asc' },
};
const sizes: readonly number[] = [10, 20, 50, 100];

export function profileTab(value: string | null): VehicleProfileTab {
  return vehicleProfileTabs.find((tab) => tab === value) ?? 'overview';
}

export function profilePage(params: ParamMap, tab: ProfileListTab): ProfileListQuery {
  const rawPage = params.get(`${tab}Page`);
  const page = rawPage !== null && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const size = Number(params.get(`${tab}Size`));
  const rawSort = params.get(`${tab}Sort`) ?? '';
  const field = rawSort.replace(/^-/, '');
  return {
    page: Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1,
    pageSize: sizes.includes(size) ? size : 20,
    sort: sortFields[tab].includes(field)
      ? { field, direction: rawSort.startsWith('-') ? 'desc' : 'asc' }
      : defaultSorts[tab],
  };
}

export function profileSortParams(tab: ProfileListTab, sort: ProfileSort): Params {
  const fallback = defaultSorts[tab];
  return {
    [`${tab}Sort`]:
      sort.field === fallback.field && sort.direction === fallback.direction
        ? null
        : `${sort.direction === 'desc' ? '-' : ''}${sort.field}`,
    [`${tab}Page`]: null,
  };
}

export function profileTripSort(sort: ProfileSort): FleetTripSort {
  return {
    field: tripSorts[sort.field] ?? 'STARTED_AT',
    direction: sort.direction === 'asc' ? 'ASC' : 'DESC',
  };
}

export function profileProblemSort(sort: ProfileSort): FleetProblemSort {
  return {
    field: problemSorts[sort.field] ?? 'TIME',
    direction: sort.direction === 'asc' ? 'ASC' : 'DESC',
  };
}

export function profileServiceSort(sort: ProfileSort): FleetServiceTaskSort {
  return {
    field: serviceSorts[sort.field] ?? 'URGENCY',
    direction: sort.direction === 'asc' ? 'ASC' : 'DESC',
  };
}

export function profilePageParams(tab: ProfileListTab, value: ProfilePage): Params {
  return {
    [`${tab}Page`]: value.page === 1 ? null : value.page,
    [`${tab}Size`]: value.pageSize === 20 ? null : value.pageSize,
  };
}

export function profileBackParams(params: ParamMap): Params {
  const ownKeys = new Set([
    'fromDriver',
    'vehicleTab',
    ...profileListTabs.flatMap((tab) => [`${tab}Page`, `${tab}Size`, `${tab}Sort`]),
  ]);
  return Object.fromEntries(
    params.keys
      .filter((key) => !ownKeys.has(key))
      .map((key) => {
        const values = params.getAll(key);
        return [key, values.length === 1 ? (values[0] ?? '') : values];
      }),
  );
}
