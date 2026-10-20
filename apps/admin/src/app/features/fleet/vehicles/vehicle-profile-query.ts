import type { ParamMap, Params } from '@angular/router';
import { vehicleProfileTabs, type VehicleProfileTab } from './vehicle-profile-view';

export const profileListTabs = ['trips', 'alerts', 'service'] as const;
export type ProfileListTab = (typeof profileListTabs)[number];
export interface ProfilePage {
  readonly page: number;
  readonly pageSize: number;
}
const sizes: readonly number[] = [10, 20, 50, 100];

export function profileTab(value: string | null): VehicleProfileTab {
  return vehicleProfileTabs.find((tab) => tab === value) ?? 'overview';
}

export function profilePage(params: ParamMap, tab: ProfileListTab): ProfilePage {
  const rawPage = params.get(`${tab}Page`);
  const page = rawPage !== null && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const size = Number(params.get(`${tab}Size`));
  return {
    page: Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1,
    pageSize: sizes.includes(size) ? size : 20,
  };
}

export function profilePageParams(tab: ProfileListTab, value: ProfilePage): Params {
  return {
    [`${tab}Page`]: value.page === 1 ? null : value.page,
    [`${tab}Size`]: value.pageSize === 20 ? null : value.pageSize,
  };
}

export function profileBackParams(params: ParamMap): Params {
  const ownKeys = new Set(profileListTabs.flatMap((tab) => [`${tab}Page`, `${tab}Size`]));
  return Object.fromEntries(
    params.keys
      .filter((key) => !ownKeys.has(key))
      .map((key) => {
        const values = params.getAll(key);
        return [key, values.length === 1 ? (values[0] ?? '') : values];
      }),
  );
}
