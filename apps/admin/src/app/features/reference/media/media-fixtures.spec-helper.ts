import type { AdminMediaDetailsFragment } from '../../../../generated/graphql/operations';
export const storeA = '10000000-0000-4000-8000-000000000001';
export const storeB = '10000000-0000-4000-8000-000000000002';
export const eventA = '60000000-0000-4000-8000-000000000001';
export function imageRecord(
  originalName = 'first.png',
  id = '80000000-0000-4000-8000-000000000001',
): AdminMediaDetailsFragment {
  return {
    __typename: 'ReferenceEventMedia',
    id,
    eventId: eventA,
    originalName,
    contentType: 'image/png',
    byteSize: 128,
    altText: null,
    position: 0,
    isCover: true,
    readUrl: `https://images.example.com/${id}`,
    readUrlExpiresAt: '2030-01-01T00:00:00Z',
    createdAt: '2026-10-06T00:00:00Z',
  };
}
export function mediaResponse(rows = [imageRecord()]) {
  return { data: { referenceEventMedia: rows } };
}
export const uploadTarget = {
  __typename: 'ReferenceUploadIntent',
  uploadId: '90000000-0000-4000-8000-000000000001',
  fileKey: 'captured',
  uploadUrl: 'https://images.example.com/upload',
  method: 'PUT',
  headers: [{ name: 'authorization', value: 'Bearer test-capability' }],
  expiresAt: '2030-01-01T00:00:00Z',
};
