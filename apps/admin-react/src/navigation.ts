import type { TFunction } from 'i18next';
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
  t: TFunction<['shell', 'products', 'reference', 'prototype', 'stores', 'common']>,
): NavigationGroup[] {
  const groups: NavigationGroup[] = [
    ...(dataSource === 'mock'
      ? [
          {
            key: 'prototype',
            label: t('prototype:mode'),
            items: [
              {
                key: 'ui-catalog',
                label: t('navigation.catalog'),
                icon: 'material-symbols:dashboard-customize-outline-rounded' as const,
              },
            ],
          },
        ]
      : []),
    {
      key: 'workspace',
      label: t('navigation.workspace'),
      items: [
        {
          key: 'products',
          label: t('products:title'),
          icon: 'material-symbols:inventory-2-outline-rounded',
        },
      ],
    },
    ...(referenceEnabled
      ? [
          {
            key: 'reference',
            label: t('navigation.reference'),
            items: [
              {
                key: 'reference/events',
                label: t('reference:events.title'),
                icon: 'material-symbols:calendar-month-outline-rounded' as const,
              },
              {
                key: 'reference/venues',
                label: t('reference:venues.title'),
                icon: 'material-symbols:location-on-outline-rounded' as const,
              },
              {
                key: 'reference/speakers',
                label: t('reference:speakers.title'),
                icon: 'material-symbols:person-outline-rounded' as const,
              },
              {
                key: 'reference/tags',
                label: t('reference:tags.title'),
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
