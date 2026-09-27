import type { UploadIntent, EventMedia } from '../generated/prisma/client.js';
import type { ReferenceUploadIntent, ReferenceEventMedia } from '../generated/graphql/types.js';

// This is the direct-PUT contract; only the local adapter exposes HTTP file streams.
export abstract class MediaStorage {
  abstract uploadTarget(
    intent: UploadIntent,
    token: string,
  ): Omit<ReferenceUploadIntent, 'uploadId' | 'fileKey'>;
  abstract verify(fileKey: string, byteSize: number, contentType: string): Promise<void>;
  abstract readTarget(media: EventMedia): Pick<ReferenceEventMedia, 'readUrl' | 'readUrlExpiresAt'>;
  abstract remove(fileKey: string): Promise<void>;
}
