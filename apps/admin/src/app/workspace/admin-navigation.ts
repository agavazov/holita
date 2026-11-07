import { messages, type Language } from '../i18n/messages';
import type { NavGroup } from '../layout/navigation';

/** Branch navigation: primary Fleet sections and the implemented Settings pages. */
export function adminNavigation(
  language: Language,
  branchId: string | null,
  fleetEnabled: boolean,
): NavGroup[] {
  const text = messages[language];
  const users: NavGroup = {
    id: 'settings',
    label: text.settings,
    headingHidden: true,
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
        {
          id: 'dashboard',
          label: text.dashboard,
          icon: 'th-large',
          link: [...fleet, 'dashboard', 'overview'],
          activePrefix: [...fleet, 'dashboard'],
        },
        {
          id: 'command-queue',
          label: text.commands,
          icon: 'clock',
          link: [...fleet, 'command-queue'],
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
      headingHidden: true,
      items: [
        {
          id: 'settings',
          label: text.settings,
          icon: 'info-circle',
          link: [...fleet, 'settings', 'general'],
          activePrefix: [...fleet, 'settings'],
        },
        ...users.items,
      ],
    },
  ];
}
