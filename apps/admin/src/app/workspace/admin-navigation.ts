import { messages, type Language } from '../i18n/messages';
import type { NavGroup } from '../layout/navigation';

/** The sidebar navigation: Fleet (with a selected Branch and Fleet enabled) and Karma Client. */
export function adminNavigation(
  language: Language,
  branchId: string | null,
  fleetEnabled: boolean,
): NavGroup[] {
  const text = messages[language];
  const groups: NavGroup[] = [];
  if (fleetEnabled && branchId) {
    const fleet = ['/', language, branchId, 'fleet'];
    groups.push({
      id: 'monitoring',
      label: text.monitoring,
      items: [
        { id: 'overview', label: text.overview, icon: 'th-large', link: [...fleet, 'overview'] },
        { id: 'alerts', label: text.alerts, icon: 'bell', link: [...fleet, 'alerts'] },
        { id: 'trips', label: text.tripLog, icon: 'directions', link: [...fleet, 'trips'] },
      ],
    });
    groups.push({
      id: 'fleet',
      label: text.fleet,
      items: [
        { id: 'vehicles', label: text.vehicles, icon: 'truck', link: [...fleet, 'vehicles'] },
        { id: 'drivers', label: text.drivers, icon: 'id-card', link: [...fleet, 'drivers'] },
        { id: 'devices', label: text.devices, icon: 'mobile', link: [...fleet, 'devices'] },
        {
          id: 'maintenance',
          label: text.maintenance,
          icon: 'wrench',
          link: [...fleet, 'maintenance'],
        },
      ],
    });
  }
  const karma = ['/', language, 'karma-client'];
  groups.push({
    id: 'karma-client',
    label: text.karmaClient,
    note: text.temporary,
    items: [
      {
        id: 'karma-monitoring',
        label: text.monitoring,
        icon: 'th-large',
        link: [...karma, 'monitoring'],
      },
      { id: 'karma-cars', label: text.karmaTrucks, icon: 'car', link: [...karma, 'cars'] },
      {
        id: 'karma-administration',
        label: text.karmaAdministration,
        icon: 'users',
        link: [...karma, 'administration'],
      },
      { id: 'karma-settings', label: text.settings, icon: 'clock', link: [...karma, 'settings'] },
    ],
  });
  if (fleetEnabled && branchId) {
    const fleet = ['/', language, branchId, 'fleet'];
    groups.push({
      id: 'settings',
      label: text.settings,
      items: [
        {
          id: 'vehicle-groups',
          label: text.vehicleGroups,
          icon: 'tags',
          link: [...fleet, 'settings', 'groups'],
        },
        {
          id: 'general',
          label: text.settingsGeneral,
          icon: 'info-circle',
          link: [...fleet, 'settings', 'general'],
        },
      ],
    });
  }
  return groups;
}
