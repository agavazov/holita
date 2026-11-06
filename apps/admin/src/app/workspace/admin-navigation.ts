import { messages, type Language } from '../i18n/messages';
import type { NavGroup } from '../layout/navigation';

/** Branch navigation: primary Fleet sections and the implemented Settings pages. */
export function adminNavigation(
  language: Language,
  branchId: string | null,
  fleetEnabled: boolean,
): NavGroup[] {
  const text = messages[language];
  if (!fleetEnabled || !branchId) {
    return [];
  }
  const fleet = ['/', language, branchId, 'fleet'];
  return [
    {
      id: 'main',
      label: text.navigation,
      headingHidden: true,
      items: [
        {
          id: 'dashboard',
          label: text.dashboard,
          icon: 'th-large',
          link: [...fleet, 'dashboard', 'overview'],
          activePrefix: [...fleet, 'dashboard'],
        },
        { id: 'vehicles', label: text.vehicles, icon: 'truck', link: [...fleet, 'vehicles'] },
        { id: 'devices', label: text.devices, icon: 'mobile', link: [...fleet, 'devices'] },
        { id: 'drivers', label: text.drivers, icon: 'id-card', link: [...fleet, 'drivers'] },
        {
          id: 'maintenance',
          label: text.maintenance,
          icon: 'wrench',
          link: [...fleet, 'maintenance'],
        },
      ],
    },
    {
      id: 'settings',
      label: text.settings,
      items: [
        {
          id: 'general',
          label: text.settingsGeneral,
          icon: 'info-circle',
          link: [...fleet, 'settings', 'general'],
        },
        {
          id: 'vehicle-groups',
          label: text.vehicleGroups,
          icon: 'tags',
          link: [...fleet, 'settings', 'groups'],
        },
      ],
    },
  ];
}
