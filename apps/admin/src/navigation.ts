import type { DataSource } from './config.js';
import type { NavigationGroup } from './layout/types.js';

export function defaultSection(dataSource: DataSource) {
  return dataSource === 'mock' ? 'reference/tags' : 'products';
}

export function sectionAvailable(dataSource: DataSource, section: string) {
  if (section === 'ui-catalog') return dataSource === 'mock';
  return (
    dataSource === 'graphql' ||
    [
      'products',
      'reference/events',
      'reference/venues',
      'reference/speakers',
      'reference/tags',
    ].includes(section)
  );
}

export function workspaceNavigation(
  dataSource: DataSource,
  referenceEnabled: boolean,
): NavigationGroup[] {
  const groups: NavigationGroup[] = [
    ...(dataSource === 'mock'
      ? [
          {
            key: 'prototype',
            label: 'Prototype',
            items: [
              {
                key: 'ui-catalog',
                label: 'UI catalog',
                icon: 'material-symbols:dashboard-customize-outline-rounded' as const,
              },
            ],
          },
        ]
      : []),
    {
      key: 'workspace',
      label: 'Workspace',
      items: [
        {
          key: 'products',
          label: 'Products',
          icon: 'material-symbols:inventory-2-outline-rounded',
        },
      ],
    },
    ...(referenceEnabled
      ? [
          {
            key: 'reference',
            label: 'Reference',
            items: [
              {
                key: 'reference/events',
                label: 'Events',
                icon: 'material-symbols:calendar-month-outline-rounded' as const,
              },
              {
                key: 'reference/venues',
                label: 'Venues',
                icon: 'material-symbols:location-on-outline-rounded' as const,
              },
              {
                key: 'reference/speakers',
                label: 'Speakers',
                icon: 'material-symbols:person-outline-rounded' as const,
              },
              {
                key: 'reference/tags',
                label: 'Tags',
                icon: 'material-symbols:label-important-outline-rounded' as const,
              },
            ],
          },
        ]
      : []),
  ];
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => sectionAvailable(dataSource, item.key)),
    }))
    .filter((group) => group.items.length > 0);
}
