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
      id: 'fleet',
      label: text.fleet,
      items: [
        { id: 'vehicles', label: text.vehicles, icon: 'truck', link: [...fleet, 'vehicles'] },
        { id: 'devices', label: text.devices, icon: 'mobile', link: [...fleet, 'devices'] },
      ],
    });
  }
  const karma = ['/', language, 'karma-client'];
  groups.push({
    id: 'karma-client',
    label: text.karmaClient,
    note: text.temporary,
    items: [
      { id: 'karma-cars', label: text.karmaTrucks, icon: 'car', link: [...karma, 'cars'] },
      { id: 'karma-users', label: text.karmaUsers, icon: 'users', link: [...karma, 'users'] },
      { id: 'karma-roles', label: text.karmaRoles, icon: 'shield', link: [...karma, 'roles'] },
      {
        id: 'karma-projects',
        label: text.karmaProjects,
        icon: 'folder',
        link: [...karma, 'projects'],
      },
      {
        id: 'karma-time-zones',
        label: text.karmaTimeZones,
        icon: 'clock',
        link: [...karma, 'time-zones'],
      },
      {
        id: 'karma-api-info',
        label: text.karmaApiInfo,
        icon: 'info-circle',
        link: [...karma, 'api-info'],
      },
    ],
  });
  return groups;
}
