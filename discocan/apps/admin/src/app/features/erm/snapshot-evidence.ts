import type { AdminControlCenterSnapshotsQuery } from '../../../generated/graphql/operations';

type Snapshot =
  AdminControlCenterSnapshotsQuery['fleetDevice']['parameterSnapshots']['items'][number];

export function ermSnapshotEvidence(snapshot: Snapshot) {
  return snapshot.values.map(({ erm, title, value, outcome }) => ({
    parameter: erm?.parameter,
    title,
    value,
    outcome,
    resultCode: erm?.resultCode,
  }));
}
