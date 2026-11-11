import { messages, type Language } from '../i18n/messages';
import type { NavGroup } from '../layout/navigation';

/** Dashboard, Fleet and System destinations for the selected Branch. */
export function adminNavigation(
  language: Language,
  branchId: string | null,
  fleetEnabled: boolean,
): NavGroup[] {
  const text = messages[language];
  const users: NavGroup = {
    id: 'system',
    label: text.system,
    items: [
      { id: 'users', label: text.users, icon: 'users', link: ['/', language, 'settings', 'users'] },
    ],
  };
  if (!fleetEnabled || !branchId) {
    return [users];
  }
  const fleet = ['/', language, branchId, 'fleet'];
  return [
    {
      id: 'main',
      label: text.navigation,
      headingHidden: true,
      items: [
        { id: 'live', label: text.dashboard, icon: 'th-large', link: [...fleet, 'live'] },
        {
          id: 'dashboard',
          label: text.dashboardOld,
          icon: 'folder',
          link: [...fleet, 'dashboard', 'overview'],
          activePrefix: [...fleet, 'dashboard'],
        },
      ],
    },
    {
      id: 'fleet',
      label: text.fleet,
      items: [
        { id: 'vehicles', label: text.vehicles, icon: 'truck', link: [...fleet, 'vehicles'] },
        { id: 'devices', label: text.devices, icon: 'mobile', link: [...fleet, 'devices'] },
        { id: 'drivers', label: text.drivers, icon: 'id-card', link: [...fleet, 'drivers'] },
        {
          id: 'maintenance',
          label: text.maintenance,
          icon: 'wrench',
          link: [...fleet, 'maintenance'],
        },
        {
          id: 'geo-zones',
          label: text.geoZones,
          icon: 'directions',
          link: [...fleet, 'geo-zones'],
        },
      ],
    },
    {
      id: 'system',
      label: text.system,
      items: [
        {
          id: 'command-queue',
          label: text.commands,
          icon: 'clock',
          link: [...fleet, 'command-queue'],
        },
        {
          id: 'settings',
          label: text.settings,
          icon: 'cog',
          link: [...fleet, 'settings', 'general'],
          activePrefix: [...fleet, 'settings'],
        },
        ...users.items,
      ],
    },
  ];
}
