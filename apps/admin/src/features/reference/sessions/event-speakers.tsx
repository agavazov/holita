import { useList } from '@refinedev/core';
import { Alert, Button, Chip, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { sessionsResource, type DataError } from '../../../data/data-provider.js';
import type { ReferenceSessionDetailsFragment } from '../../../generated/graphql/operations.js';

export function EventSpeakers({ storeId, eventId }: { storeId: string; eventId: string }) {
  const sessions = useList<ReferenceSessionDetailsFragment, DataError>({
    resource: sessionsResource(storeId, eventId),
    pagination: { mode: 'off' },
    errorNotification: false,
  });
  const speakers = [
    ...new Map(
      sessions.result.data
        .flatMap((session) => session.speakers)
        .map((speaker) => [speaker.id, speaker]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Paper
      component="section"
      aria-label="Event speakers"
      background={1}
      sx={{ p: 3, borderRadius: 4, outline: 0 }}
    >
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        Speakers
      </Typography>
      {sessions.query.isPending ? (
        <Skeleton variant="rounded" height={60} />
      ) : sessions.query.error ? (
        <Alert
          severity="error"
          action={
            <Button
              onClick={() => {
                void sessions.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          {sessions.query.error.message}
        </Alert>
      ) : speakers.length ? (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          {speakers.map((speaker) => (
            <Chip
              key={speaker.id}
              size="small"
              color={speaker.active ? 'primary' : 'neutral'}
              label={`${speaker.name}${speaker.active ? '' : ' (inactive)'}`}
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Assign speakers to sessions to include them here.
        </Typography>
      )}
    </Paper>
  );
}
