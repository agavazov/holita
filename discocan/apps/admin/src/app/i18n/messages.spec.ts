import fleetAlertsBg from '../features/fleet/alerts/i18n/bg.json';
import fleetAlertsEn from '../features/fleet/alerts/i18n/en.json';
import fleetDevicesBg from '../features/fleet/devices/i18n/bg.json';
import fleetDevicesEn from '../features/fleet/devices/i18n/en.json';
import fleetDriversBg from '../features/fleet/drivers/i18n/bg.json';
import fleetDriversEn from '../features/fleet/drivers/i18n/en.json';
import fleetBg from '../features/fleet/i18n/bg.json';
import fleetEn from '../features/fleet/i18n/en.json';
import fleetMaintenanceBg from '../features/fleet/maintenance/i18n/bg.json';
import fleetMaintenanceEn from '../features/fleet/maintenance/i18n/en.json';
import fleetOverviewBg from '../features/fleet/overview/i18n/bg.json';
import fleetOverviewEn from '../features/fleet/overview/i18n/en.json';
import fleetSettingsBg from '../features/fleet/settings/i18n/bg.json';
import fleetSettingsEn from '../features/fleet/settings/i18n/en.json';
import fleetTripsBg from '../features/fleet/trips/i18n/bg.json';
import fleetTripsEn from '../features/fleet/trips/i18n/en.json';
import fleetVehiclesBg from '../features/fleet/vehicles/i18n/bg.json';
import fleetVehiclesEn from '../features/fleet/vehicles/i18n/en.json';
import mapPreviewBg from '../ui/map-preview/bg.json';
import mapPreviewEn from '../ui/map-preview/en.json';
import uiBg from '../ui/i18n/bg.json';
import uiEn from '../ui/i18n/en.json';
import bg from './bg.json';
import en from './en.json';
import { catalogParityProblems } from './catalog-parity';

/** Every Bulgarian/English catalog pair of the admin. */
const catalogs: readonly { readonly name: string; readonly bg: unknown; readonly en: unknown }[] = [
  { name: 'i18n', bg, en },
  { name: 'ui/i18n', bg: uiBg, en: uiEn },
  { name: 'features/fleet/i18n', bg: fleetBg, en: fleetEn },
  { name: 'features/fleet/alerts', bg: fleetAlertsBg, en: fleetAlertsEn },
  { name: 'features/fleet/devices', bg: fleetDevicesBg, en: fleetDevicesEn },
  { name: 'features/fleet/drivers', bg: fleetDriversBg, en: fleetDriversEn },
  { name: 'features/fleet/maintenance', bg: fleetMaintenanceBg, en: fleetMaintenanceEn },
  { name: 'features/fleet/overview', bg: fleetOverviewBg, en: fleetOverviewEn },
  { name: 'features/fleet/settings', bg: fleetSettingsBg, en: fleetSettingsEn },
  { name: 'features/fleet/trips', bg: fleetTripsBg, en: fleetTripsEn },
  { name: 'features/fleet/vehicles', bg: fleetVehiclesBg, en: fleetVehiclesEn },
  {
    name: 'ui/map-preview',
    bg: mapPreviewBg,
    en: mapPreviewEn,
  },
];

describe('application catalogs', () => {
  it('every BG/EN catalog pair has the same keys, non-empty texts and placeholders', () => {
    for (const catalog of catalogs) {
      expect(catalogParityProblems(catalog.bg, catalog.en), catalog.name).toEqual([]);
    }
  });
});
