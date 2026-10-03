import type {
  ListStoresQuery,
  ReferenceTagDetailsFragment,
  ProductDetailsFragment,
  ReferenceVenueDetailsFragment,
  ReferenceSpeakerDetailsFragment,
} from '../generated/graphql/operations.js';
import type { PrototypeEvent, PrototypeHistoryEntry, PrototypeSession } from './snapshot.js';

export const prototypeStores: ListStoresQuery['stores'] = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'holita Sofia' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'holita Plovdiv' },
];

const names = [
  'Conference',
  'Workshop',
  'Networking',
  'Community',
  'Design',
  'Technology',
  'Sustainability',
  'Business',
  'Education',
  'Culture',
  'Wellbeing',
  'Music',
  'Photography',
  'Architecture',
  'Food',
  'Travel',
  'Science',
  'Literature',
  'Film',
  'Craft',
  'Startup',
  'Leadership',
  'Volunteering',
  'Sport',
];
const colors = ['#315ed0', '#a43f76', '#328467', '#aa6625'];

export function initialTags(): ReferenceTagDetailsFragment[] {
  return prototypeStores.flatMap((store, storeIndex) =>
    names.slice(0, storeIndex === 0 ? names.length : 8).map((name, index) => ({
      id: '40000000-0000-4000-8000-' + String(storeIndex * 100 + index + 1).padStart(12, '0'),
      storeId: store.id,
      name,
      color: colors[index % colors.length] ?? '#315ed0',
      active: index % 5 !== 4,
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    })),
  );
}

const productNames = [
  'Linen tote',
  'Ceramic mug',
  'Desk notebook',
  'Cotton scarf',
  'Glass bottle',
  'Canvas pouch',
  'Wool blanket',
  'Travel journal',
  'Wooden tray',
  'Garden candle',
  'Leather wallet',
  'Studio pen',
  'Kitchen apron',
  'Art print',
  'Desk lamp',
  'Tea set',
  'Picnic basket',
  'Cotton towel',
  'Ceramic vase',
  'Travel bag',
  'Weekly planner',
  'Bamboo board',
  'Photo album',
  'Woven rug',
];
export function initialProducts(): ProductDetailsFragment[] {
  return prototypeStores.flatMap((store, storeIndex) =>
    productNames.slice(0, storeIndex === 0 ? 24 : 8).map((name, index): ProductDetailsFragment => ({
      id: '20000000-0000-4000-8000-' + String(storeIndex * 100 + index + 1).padStart(12, '0'),
      storeId: store.id,
      name,
      sku: name.toUpperCase().replaceAll(' ', '-'),
      status: index % 4 === 0 ? 'DRAFT' : 'ACTIVE',
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    })),
  );
}
const venueNames = [
  'Conference center',
  'Riverside studio',
  'Garden pavilion',
  'Library auditorium',
  'Community hall',
  'Design workshop',
  'Gallery lounge',
  'University hall',
  'Rooftop terrace',
  'Innovation hub',
  'Music studio',
  'Park amphitheater',
  'Culture house',
  'Meeting loft',
  'Technology lab',
  'Exhibition hall',
  'Creative atelier',
  'Training room',
  'Cinema lounge',
  'Business club',
  'Workshop courtyard',
  'Theater foyer',
  'Science auditorium',
  'Coworking lounge',
];
export function initialVenues(): ReferenceVenueDetailsFragment[] {
  return prototypeStores.flatMap((store, storeIndex) =>
    venueNames.slice(0, storeIndex === 0 ? 24 : 8).map((name, index) => ({
      id: '30000000-0000-4000-8000-' + String(storeIndex * 100 + index + 1).padStart(12, '0'),
      storeId: store.id,
      name,
      description: index % 4 === 0 ? null : `${name} for talks, workshops and community events.`,
      city: storeIndex === 0 ? 'Sofia' : 'Plovdiv',
      countryCode: 'BG',
      address:
        index % 3 === 0
          ? null
          : `${String(index + 10)} ${storeIndex === 0 ? 'Vitosha' : 'Central'} Street`,
      capacity: index % 4 === 0 ? null : (index + 1) * 25,
      active: index % 5 !== 4,
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    })),
  );
}
const speakerNames = [
  'Elena Petrova',
  'Nikolay Ivanov',
  'Maria Dimitrova',
  'Georgi Stoyanov',
  'Anna Nikolova',
  'Martin Georgiev',
  'Daria Koleva',
  'Petar Vasilev',
  'Lina Popova',
  'Ivan Todorov',
  'Sofia Marinova',
  'Daniel Iliev',
  'Maya Hristova',
  'Boris Angelov',
  'Vera Stefanova',
  'Alex Pavlov',
  'Nina Yordanova',
  'Victor Aleksandrov',
  'Eva Radeva',
  'Kalin Simeonov',
  'Tanya Mladenova',
  'Emil Kostov',
  'Raya Mihaylova',
  'Stefan Tsvetkov',
];
export function initialSpeakers(): ReferenceSpeakerDetailsFragment[] {
  return prototypeStores.flatMap((store, storeIndex) =>
    speakerNames.slice(0, storeIndex === 0 ? 24 : 8).map((name, index) => ({
      id: '50000000-0000-4000-8000-' + String(storeIndex * 100 + index + 1).padStart(12, '0'),
      storeId: store.id,
      name,
      email: index % 4 === 0 ? null : `${name.toLowerCase().replaceAll(' ', '.')}@example.com`,
      shortBio:
        index % 3 === 0 ? null : `${name} shares practical experience in design and technology.`,
      active: index % 5 !== 4,
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    })),
  );
}
export function initialEvents(): PrototypeEvent[] {
  return prototypeStores.flatMap((store, storeIndex) =>
    names.slice(0, storeIndex === 0 ? 24 : 8).map((name, index): PrototypeEvent => {
      const suffix = String(storeIndex * 100 + 1).padStart(12, '0');
      const format = index % 3 === 0 ? 'IN_PERSON' : index % 3 === 1 ? 'ONLINE' : 'HYBRID';
      const createdAt = new Date(Date.UTC(2026, 8, 2, 0, index)).toISOString();
      return {
        id: '60000000-0000-4000-8000-' + String(storeIndex * 100 + index + 1).padStart(12, '0'),
        storeId: store.id,
        title: `${name} forum`,
        code: name.toUpperCase().replaceAll(' ', '-') + '-2026',
        status: index % 3 === 0 ? 'PUBLISHED' : index % 3 === 1 ? 'DRAFT' : 'ARCHIVED',
        format,
        capacity: index % 4 === 0 ? null : (index + 1) * 20,
        budget: index % 4 === 0 ? null : `${String((index + 1) * 250)}.00`,
        featured: index % 4 === 0,
        startsAt: new Date(Date.UTC(2026, 10, 10 + index, 8)).toISOString(),
        endsAt: new Date(Date.UTC(2026, 10, 10 + index, 16)).toISOString(),
        registrationOpensOn: index % 4 === 0 ? null : '2026-10-01',
        registrationClosesOn: index % 4 === 0 ? null : '2026-11-01',
        venueId: format === 'ONLINE' ? null : '30000000-0000-4000-8000-' + suffix,
        meetingUrl:
          format === 'IN_PERSON' ? null : `https://meet.example.com/${name.toLowerCase()}`,
        tagIds: ['40000000-0000-4000-8000-' + suffix],
        summary: `A practical ${name.toLowerCase()} event in ${storeIndex === 0 ? 'Sofia' : 'Plovdiv'}.`,
        descriptionHtml: `<h2>${name} forum</h2><p>Talks, workshops and time to meet the community.</p><ul><li>Practical examples</li><li>Open discussion</li></ul>`,
        deletedAt: index >= (storeIndex === 0 ? 22 : 6) ? '2026-09-20T10:00:00.000Z' : null,
        createdAt,
        updatedAt: createdAt,
      };
    }),
  );
}
export function initialSessions(events: PrototypeEvent[]): PrototypeSession[] {
  const titles = ['Welcome and introductions', 'Practical workshop', 'Questions and next steps'];
  return events.flatMap((event, eventIndex) =>
    titles.map((title, position): PrototypeSession => ({
      id: '70000000-0000-4000-8000-' + String(eventIndex * 3 + position + 1).padStart(12, '0'),
      storeId: event.storeId,
      eventId: event.id,
      title,
      summary: position === 1 ? 'Explore concrete examples together.' : null,
      room: event.format === 'ONLINE' ? null : 'Main hall',
      startsAt: new Date(Date.parse(event.startsAt) + (position + 1) * 3600000).toISOString(),
      endsAt: new Date(Date.parse(event.startsAt) + (position + 2) * 3600000).toISOString(),
      position,
      speakerIds: [
        '50000000-0000-4000-8000-' +
          String(event.storeId === prototypeStores[0]?.id ? 1 : 101).padStart(12, '0'),
      ],
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    })),
  );
}
export function initialHistory(events: PrototypeEvent[]): PrototypeHistoryEntry[] {
  return events.flatMap((event, index) => {
    const created: PrototypeHistoryEntry = {
      id: '90000000-0000-4000-8000-' + String(index * 2 + 1).padStart(12, '0'),
      storeId: event.storeId,
      eventId: event.id,
      operation: 'CREATED',
      actor: 'Anonymous',
      subject: null,
      createdAt: event.createdAt,
      changes: [
        { field: 'title', before: null, after: event.title },
        { field: 'code', before: null, after: event.code },
      ],
    };
    return event.deletedAt
      ? [
          created,
          {
            ...created,
            id: '90000000-0000-4000-8000-' + String(index * 2 + 2).padStart(12, '0'),
            operation: 'TRASHED',
            createdAt: event.deletedAt,
            changes: [],
          },
        ]
      : [created];
  });
}
