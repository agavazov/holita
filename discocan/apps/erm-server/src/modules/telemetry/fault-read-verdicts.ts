import type { PrismaService } from '../../database/prisma.service.js';
import { sqlNullableDate, sqlRows, sqlText } from '../../database/sql.js';
import { Prisma, type ErmCommandRequest } from '../../generated/prisma/client.js';
import type { ErmFaultReadVerdict } from '../../generated/graphql/types.js';

/**
 * The eData verdict of each sent fault-logger read (GET DTC): the unit's first event-33 report
 * `154` from sending until 120 s after the tracker's answer. `154,0` means an empty fault buffer;
 * `154,1` is followed by a `419` that repeats every current code as added. Earlier `154`
 * acknowledgements of other eData commands precede the send and are not taken.
 */
export async function faultReadVerdicts(
  prisma: Pick<PrismaService, 'client' | 'schema'>,
  requests: readonly Pick<ErmCommandRequest, 'id' | 'unitId' | 'action' | 'commandId'>[],
  commands: readonly { id: string; sentAt: Date; answeredAt: Date | null }[],
): Promise<Map<string, ErmFaultReadVerdict>> {
  const reads = requests.flatMap((request) => {
    const command = commands.find((item) => item.id === request.commandId);
    return request.action === 'READ_EDATA_FAULTS' && command
      ? [
          {
            id: request.id,
            unitId: request.unitId,
            sentAt: command.sentAt,
            until: new Date((command.answeredAt ?? command.sentAt).getTime() + 120_000),
          },
        ]
      : [];
  });
  if (!reads.length) {
    return new Map();
  }
  const table = (name: 'ermEvent' | 'ermFrame') =>
    Prisma.raw(`"${prisma.schema.replaceAll('"', '""')}"."${name}"`);
  // eventTime bounds only select the unit's index range; frame receipt decides the order.
  const rows = sqlRows(
    await prisma.client.$queryRaw(Prisma.sql`
      SELECT read.id, verdict.value, verdict."receivedAt", codes.count
      FROM jsonb_to_recordset(${JSON.stringify(reads)}::jsonb)
        AS read(id text, "unitId" text, "sentAt" timestamptz, until timestamptz)
      CROSS JOIN LATERAL (
        SELECT event.fields -> 'extra' ->> 3 AS value, frame."receivedAt"
        FROM ${table('ermEvent')} event
        JOIN ${table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = read."unitId" AND event."eventId" = '33'
          AND event."eventTime" BETWEEN read."sentAt" - interval '10 minutes'
            AND read.until + interval '10 minutes'
          AND event.fields -> 'extra' ->> 2 = '154' AND event.fields -> 'extra' ->> 3 IN ('0', '1')
          AND frame."receivedAt" BETWEEN read."sentAt" AND read.until
        ORDER BY frame."receivedAt", event.id
        LIMIT 1
      ) verdict
      LEFT JOIN LATERAL (
        SELECT count(DISTINCT concat(fault ->> 'spn', '/', fault ->> 'fmi'))::int AS count
        FROM ${table('ermEvent')} event
        JOIN ${table('ermFrame')} frame ON frame.id = event."frameId"
        CROSS JOIN LATERAL jsonb_array_elements(event.fields -> 'edata' -> 'faults') fault
        WHERE verdict.value = '1' AND event."unitId" = read."unitId" AND event."eventId" = '33'
          AND event."eventTime" BETWEEN verdict."receivedAt" - interval '10 minutes'
            AND verdict."receivedAt" + interval '10 minutes'
          AND event.fields -> 'edata' ->> 'type' = '419' AND fault ->> 'status' = '1'
          AND frame."receivedAt" BETWEEN verdict."receivedAt"
            AND verdict."receivedAt" + interval '30 seconds'
        HAVING count(*) > 0
      ) codes ON true
    `),
  );
  return new Map(
    rows.map((row) => {
      const receivedAt = sqlNullableDate(row, 'receivedAt');
      const count = row['count'];
      if (receivedAt === null || (count !== null && typeof count !== 'number')) {
        throw new Error('Invalid ERM fault read verdict row');
      }
      return [
        sqlText(row, 'id'),
        { activeCodes: sqlText(row, 'value') === '1', codeCount: count, receivedAt },
      ];
    }),
  );
}
