import type { PrismaClient } from '../src/generated/prisma/client.js';

// Stable store IDs are a seed contract, not an import from another application's model.
export const venueSeeds = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'The Glasshouse',
    city: 'Sofia',
    countryCode: 'BG',
    capacity: 240,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'Studio 12',
    city: 'Sofia',
    countryCode: 'BG',
    capacity: 60,
  },
  {
    id: '30000000-0000-4000-8000-000000000101',
    storeId: '10000000-0000-4000-8000-000000000002',
    name: 'Riverside Hall',
    city: 'Plovdiv',
    countryCode: 'BG',
    capacity: 180,
  },
];

export function seedVenues(client: PrismaClient) {
  return client.venue.createMany({ data: venueSeeds, skipDuplicates: true });
}

export const tagSeeds = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'Community',
    color: '#315ed0',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'Workshop',
    color: '#13876e',
  },
  {
    id: '40000000-0000-4000-8000-000000000101',
    storeId: '10000000-0000-4000-8000-000000000002',
    name: 'Culture',
    color: '#9254de',
  },
];
export const speakerSeeds = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'Alex Marin',
    shortBio: 'Fictional speaker exploring community-led design.',
  },
  {
    id: '50000000-0000-4000-8000-000000000101',
    storeId: '10000000-0000-4000-8000-000000000002',
    name: 'Mira Koleva',
    shortBio: 'Fictional speaker sharing stories about urban culture.',
  },
];
export async function seedReference(client: PrismaClient) {
  await seedVenues(client);
  await client.tag.createMany({ data: tagSeeds, skipDuplicates: true });
  await client.speaker.createMany({ data: speakerSeeds, skipDuplicates: true });
  await client.event.createMany({
    data: [
      {
        id: '60000000-0000-4000-8000-000000000001',
        storeId: '10000000-0000-4000-8000-000000000001',
        title: 'Sofia Creative Forum',
        code: 'SOFIA-FORUM',
        format: 'IN_PERSON',
        status: 'DRAFT',
        startsAt: new Date('2026-11-12T08:00:00Z'),
        endsAt: new Date('2026-11-12T16:00:00Z'),
        venueId: '30000000-0000-4000-8000-000000000001',
        capacity: 180,
        budget: '12500.00',
        summary: 'A fictional day of ideas, conversations and practical workshops.',
      },
      {
        id: '60000000-0000-4000-8000-000000000101',
        storeId: '10000000-0000-4000-8000-000000000002',
        title: 'Plovdiv Culture Exchange',
        code: 'PLOVDIV-EXCHANGE',
        format: 'ONLINE',
        startsAt: new Date('2026-11-18T14:00:00Z'),
        endsAt: new Date('2026-11-18T16:00:00Z'),
        meetingUrl: 'https://example.com/plovdiv-exchange',
        summary: 'A fictional online gathering about culture and local communities.',
      },
    ],
    skipDuplicates: true,
  });
}
