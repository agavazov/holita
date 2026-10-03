import type { PrototypeEvent, PrototypeMedia } from './snapshot.js';

// Local Picsum placeholders, 1200 x 800; fixture bytes never enter browser storage.
// Sources: https://picsum.photos/id/1015/1200/800.webp and https://picsum.photos/id/1035/1200/800.webp.
export const prototypeMediaFixtures = {
  collaboration: { path: '/images/tmp/collaboration.webp', byteSize: 150454 },
  workshop: { path: '/images/tmp/workshop.webp', byteSize: 59488 },
};
export function initialMedia(events: PrototypeEvent[]): PrototypeMedia[] {
  return events
    .filter(
      (event) =>
        event.id === '60000000-0000-4000-8000-000000000001' ||
        event.id === '60000000-0000-4000-8000-000000000101',
    )
    .flatMap((event, index) =>
      (['collaboration', 'workshop'] as const).map((fixture, position) => ({
        id: `80000000-0000-4000-8000-${String(index * 100 + position + 1).padStart(12, '0')}`,
        storeId: event.storeId,
        eventId: event.id,
        uploadId: null,
        fixture,
        originalName: `${fixture}.webp`,
        contentType: 'image/webp',
        byteSize: prototypeMediaFixtures[fixture].byteSize,
        altText:
          fixture === 'collaboration'
            ? 'Placeholder photo of a fjord'
            : 'Placeholder photo of a waterfall',
        position,
        isCover: position === 0,
        createdAt: event.createdAt,
      })),
    );
}
