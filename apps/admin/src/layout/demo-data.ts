// Presentation examples only. No session, authentication or business records are represented.
import type { TranslationKey } from '../localization/dictionaries.js';

export const exampleProfile = {
  nameKey: 'shell.guest' as const satisfies TranslationKey,
  designationKey: 'shell.exampleProfile' as const satisfies TranslationKey,
  avatar: '/images/tmp/avatar/14.webp',
};

export type ExampleNotification = {
  id: string;
  group: 'today' | 'older';
  detailKey: TranslationKey;
  timeKey: TranslationKey;
  avatar: string;
  read: boolean;
};

export const exampleNotifications: readonly ExampleNotification[] = [
  {
    id: 'welcome',
    group: 'today',
    detailKey: 'shell.notificationWelcome',
    timeKey: 'shell.fiveMinutesAgo',
    avatar: '/images/tmp/avatar/14.webp',
    read: false,
  },
  {
    id: 'catalog',
    group: 'today',
    detailKey: 'shell.notificationCatalog',
    timeKey: 'shell.twentyMinutesAgo',
    avatar: '/images/tmp/avatar/1.webp',
    read: false,
  },
  {
    id: 'event',
    group: 'today',
    detailKey: 'shell.notificationEvent',
    timeKey: 'shell.oneHourAgo',
    avatar: '/images/tmp/avatar/2.webp',
    read: false,
  },
  {
    id: 'team',
    group: 'older',
    detailKey: 'shell.notificationTeam',
    timeKey: 'shell.yesterday',
    avatar: '/images/tmp/avatar/3.webp',
    read: true,
  },
  {
    id: 'ready',
    group: 'older',
    detailKey: 'shell.notificationReady',
    timeKey: 'shell.twoDaysAgo',
    avatar: '/images/tmp/avatar/14.webp',
    read: true,
  },
];
