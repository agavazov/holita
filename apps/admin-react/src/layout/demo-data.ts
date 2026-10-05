// Presentation examples only. No session, authentication or business records are represented.
export const exampleProfile = {
  avatar: '/images/tmp/avatar/14.webp',
};
export type ExampleNotification = {
  id: 'welcome' | 'catalog' | 'event' | 'team' | 'ready';
  group: 'today' | 'older';
  avatar: string;
  read: boolean;
};
export const exampleNotifications: readonly ExampleNotification[] = [
  {
    id: 'welcome',
    group: 'today',
    avatar: '/images/tmp/avatar/14.webp',
    read: false,
  },
  {
    id: 'catalog',
    group: 'today',
    avatar: '/images/tmp/avatar/1.webp',
    read: false,
  },
  {
    id: 'event',
    group: 'today',
    avatar: '/images/tmp/avatar/2.webp',
    read: false,
  },
  {
    id: 'team',
    group: 'older',
    avatar: '/images/tmp/avatar/3.webp',
    read: true,
  },
  {
    id: 'ready',
    group: 'older',
    avatar: '/images/tmp/avatar/14.webp',
    read: true,
  },
];
