// Presentation examples only. No session, authentication or business records are represented.
export const exampleProfile = {
  name: 'Guest',
  designation: 'Example profile',
  avatar: '/temp/avatar/14.webp',
};
export type ExampleNotification = {
  id: string;
  group: 'today' | 'older';
  detail: string;
  time: string;
  avatar: string;
  read: boolean;
};
export const exampleNotifications: readonly ExampleNotification[] = [
  {
    id: 'welcome',
    group: 'today',
    detail: 'Welcome to your holita workspace. Everything you need is in the new navigation.',
    time: '5 minutes ago',
    avatar: '/temp/avatar/14.webp',
    read: false,
  },
  {
    id: 'catalog',
    group: 'today',
    detail: 'Your example catalog review is ready. Take a look at the latest updates.',
    time: '20 minutes ago',
    avatar: '/temp/avatar/1.webp',
    read: false,
  },
  {
    id: 'event',
    group: 'today',
    detail: 'A new event has been added to the example schedule.',
    time: '1 hour ago',
    avatar: '/temp/avatar/2.webp',
    read: false,
  },
  {
    id: 'team',
    group: 'older',
    detail: 'Your team shared an example workspace update with you.',
    time: 'Yesterday',
    avatar: '/temp/avatar/3.webp',
    read: true,
  },
  {
    id: 'ready',
    group: 'older',
    detail: 'The workspace is ready to explore. Choose a store to get started.',
    time: '2 days ago',
    avatar: '/temp/avatar/14.webp',
    read: true,
  },
];
