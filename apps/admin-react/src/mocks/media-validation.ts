import { DataError } from '../data/data-error.js';
import type { PrototypeMedia, PrototypeSnapshot } from './snapshot.js';
import { prototypeStores } from './fixtures.js';
import { uuid, validOptionalText, validText } from './validation.js';

export const mediaMaxBytes = 5 * 1024 * 1024;
export const mediaContentTypes = ['image/jpeg', 'image/png', 'image/webp'];
const invalidImage = () =>
  new DataError('Upload a complete, still JPEG, PNG or WebP image of at most 20 megapixels.');

export async function inspectPrototypeImage(blob: Blob, contentType: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const ascii = (start: number, count: number) =>
    String.fromCharCode(...bytes.slice(start, start + count));
  let valid = false;
  if (
    contentType === 'image/png' &&
    bytes.length >= 33 &&
    ascii(1, 3) === 'PNG' &&
    bytes[0] === 137 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  ) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset),
        chunk = ascii(offset + 4, 4);
      if (offset + length + 12 > bytes.length || chunk === 'acTL') throw invalidImage();
      if (
        chunk === 'IHDR' &&
        (length !== 13 || view.getUint32(offset + 8) * view.getUint32(offset + 12) > 20_000_000)
      )
        throw invalidImage();
      offset += length + 12;
      if (chunk === 'IEND') {
        valid = offset === bytes.length;
        break;
      }
    }
  } else if (contentType === 'image/jpeg') {
    valid =
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255 &&
      bytes.at(-2) === 255 &&
      bytes.at(-1) === 217;
  } else if (
    contentType === 'image/webp' &&
    bytes.length >= 20 &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 4) === 'WEBP' &&
    view.getUint32(4, true) + 8 === bytes.length
  ) {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const length = view.getUint32(offset + 4, true),
        chunk = ascii(offset, 4);
      if (
        chunk === 'ANIM' ||
        chunk === 'ANMF' ||
        (chunk === 'VP8X' && ((bytes[offset + 8] ?? 0) & 2) !== 0)
      )
        throw invalidImage();
      offset += 8 + length + (length % 2);
    }
    valid = offset === bytes.length;
  }
  if (!valid) throw invalidImage();
  try {
    const image = await createImageBitmap(blob);
    try {
      if (image.width < 1 || image.height < 1 || image.width * image.height > 20_000_000)
        throw invalidImage();
    } finally {
      image.close();
    }
  } catch {
    throw invalidImage();
  }
}

function validId(value: unknown): value is string {
  try {
    return typeof value === 'string' && uuid(value, 'id') === value;
  } catch {
    return false;
  }
}
export function validMedia(value: unknown): value is PrototypeMedia {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    validId(value.id) &&
    'storeId' in value &&
    prototypeStores.some((store) => store.id === value.storeId) &&
    'eventId' in value &&
    validId(value.eventId) &&
    'fixture' in value &&
    (value.fixture === null || value.fixture === 'collaboration' || value.fixture === 'workshop') &&
    'uploadId' in value &&
    (value.fixture === null ? validId(value.uploadId) : value.uploadId === null) &&
    'originalName' in value &&
    validText(value.originalName, 255) &&
    'contentType' in value &&
    typeof value.contentType === 'string' &&
    mediaContentTypes.includes(value.contentType) &&
    'byteSize' in value &&
    typeof value.byteSize === 'number' &&
    Number.isInteger(value.byteSize) &&
    value.byteSize >= 1 &&
    value.byteSize <= mediaMaxBytes &&
    'altText' in value &&
    validOptionalText(value.altText, 300) &&
    'position' in value &&
    typeof value.position === 'number' &&
    Number.isInteger(value.position) &&
    value.position >= 0 &&
    value.position <= 2147483647 &&
    'isCover' in value &&
    typeof value.isCover === 'boolean' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt))
  );
}
export function validMediaRelations(snapshot: PrototypeSnapshot) {
  return (
    new Set(snapshot.media.map((row) => row.id)).size === snapshot.media.length &&
    new Set(snapshot.media.filter((row) => row.uploadId).map((row) => row.uploadId)).size ===
      snapshot.media.filter((row) => row.uploadId).length &&
    snapshot.media.every((row) =>
      snapshot.events.some((event) => event.storeId === row.storeId && event.id === row.eventId),
    ) &&
    snapshot.events.every((event) => {
      const rows = snapshot.media.filter((row) => row.eventId === event.id);
      return (
        rows.length <= 10 &&
        new Set(rows.map((row) => row.position)).size === rows.length &&
        rows.filter((row) => row.isCover).length === (rows.length ? 1 : 0)
      );
    })
  );
}
