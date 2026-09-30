import { useList } from '@refinedev/core';
import {
  Alert,
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';
import { Fragment, useState } from 'react';
import { historyResource, type DataError } from '../../../data/data-provider.js';
import type {
  ListReferenceEventHistoryQuery,
  ReferenceEventHistoryOperation,
} from '../../../generated/graphql/operations.js';
import { eventTime } from './event-time.js';

type Entry = ListReferenceEventHistoryQuery['referenceEventHistory']['items'][number];
const operations: Record<ReferenceEventHistoryOperation, string> = {
  CREATED: 'Event created',
  UPDATED: 'Event updated',
  TRASHED: 'Moved to trash',
  RESTORED: 'Event restored',
  SESSION_CREATED: 'Session created',
  SESSION_UPDATED: 'Session updated',
  SESSION_DELETED: 'Session deleted',
  SESSIONS_REORDERED: 'Sessions reordered',
  MEDIA_ADDED: 'Image added',
  MEDIA_UPDATED: 'Image updated',
  MEDIA_REMOVED: 'Image removed',
  MEDIA_REORDERED: 'Images reordered',
  COVER_CHANGED: 'Cover changed',
};
const fields: Record<string, string> = {
  title: 'Title',
  code: 'Code',
  status: 'Status',
  format: 'Format',
  capacity: 'Capacity',
  budget: 'Budget (EUR)',
  featured: 'Featured',
  startsAt: 'Start (UTC)',
  endsAt: 'End (UTC)',
  registrationOpensOn: 'Registration opens',
  registrationClosesOn: 'Registration closes',
  venue: 'Venue',
  tags: 'Tags',
  meetingUrl: 'Meeting link',
  summary: 'Summary',
  descriptionHtml: 'Description (HTML excerpt)',
  room: 'Room',
  speakers: 'Speakers',
  sessionOrder: 'Session order',
  galleryOrder: 'Image order',
  cover: 'Cover',
  altText: 'Alternative text',
};
export function EventHistory({ storeId, eventId }: { storeId: string; eventId: string }) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string[]>([]);
  const history = useList<Entry, DataError>({
    resource: historyResource(storeId, eventId),
    pagination: { currentPage: page, pageSize: 20, mode: 'server' },
    errorNotification: false,
  });
  const total = history.result.total ?? 0;
  return (
    <Stack component="section" aria-label="Event history" sx={{ gap: 3, minWidth: 0 }}>
      <Box>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          Event history
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Saved changes, newest first · Europe/Sofia. Long values are shown as excerpts.
        </Typography>
      </Box>
      {history.query.isError && (
        <Alert
          severity="error"
          action={
            <Button
              onClick={() => {
                void history.query.refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          {history.query.error.message}
        </Alert>
      )}
      <TableContainer>
        <Table aria-label="Saved event changes" sx={{ minWidth: 620 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 56 }}>
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                    clipPath: 'inset(50%)',
                  }}
                >
                  Details
                </Box>
              </TableCell>
              <TableCell>Change</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>When (Sofia)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.query.isPending || history.query.isError || !history.result.data.length ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center' }}>
                  {history.query.isPending
                    ? 'Loading history…'
                    : history.query.isError
                      ? 'History unavailable'
                      : 'No changes recorded yet.'}
                </TableCell>
              </TableRow>
            ) : (
              history.result.data.map((entry) => (
                <Fragment key={entry.id}>
                  <TableRow>
                    <TableCell>
                      {entry.changes.length > 0 && (
                        <Button
                          size="small"
                          shape="square"
                          color="neutral"
                          aria-label={expanded.includes(entry.id) ? 'Collapse row' : 'Expand row'}
                          aria-expanded={expanded.includes(entry.id)}
                          aria-controls={`history-${entry.id}`}
                          onClick={() => {
                            setExpanded(
                              expanded.includes(entry.id)
                                ? expanded.filter((id) => id !== entry.id)
                                : [...expanded, entry.id],
                            );
                          }}
                        >
                          <IconifyIcon
                            icon="material-symbols:expand-more-rounded"
                            sx={{
                              fontSize: 20,
                              transform: expanded.includes(entry.id) ? 'rotate(180deg)' : 'none',
                            }}
                          />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" color="text.primary">
                        {operations[entry.operation]}
                      </Typography>
                      {entry.subject && (
                        <Typography
                          variant="body2"
                          sx={{ overflowWrap: 'anywhere', maxWidth: 400 }}
                        >
                          {entry.subject}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{entry.actor}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {eventTime(entry.createdAt).format('DD MMM YYYY, HH:mm:ss')}
                    </TableCell>
                  </TableRow>
                  {expanded.includes(entry.id) && (
                    <TableRow id={`history-${entry.id}`}>
                      <TableCell colSpan={4} sx={{ bgcolor: 'background.elevation1' }}>
                        <Stack
                          sx={{
                            gap: 2,
                            maxWidth: 900,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {entry.changes.map((change) => (
                            <Box key={change.field}>
                              <Typography variant="subtitle2" color="text.primary">
                                {fields[change.field] ?? change.field}
                              </Typography>
                              <Typography variant="body2">
                                <Box component="span" color="text.secondary">
                                  Before:{' '}
                                </Box>
                                {change.before ?? '—'}
                              </Typography>
                              <Typography variant="body2">
                                <Box component="span" color="text.secondary">
                                  After:{' '}
                                </Box>
                                {change.after ?? '—'}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack
        direction="row"
        sx={{
          px: { xs: 1, sm: 3 },
          py: 1,
          mt: -3,
          gap: 1,
          alignItems: 'center',
          bgcolor: 'background.elevation1',
          borderRadius: '0 0 16px 16px',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          {history.query.isPending ? 'Loading…' : `Page ${String(page)} · ${String(total)} changes`}
        </Typography>
        <Button
          size="small"
          aria-label="Previous page"
          disabled={page === 1 || history.query.isFetching}
          onClick={() => {
            setExpanded([]);
            setPage(page - 1);
          }}
        >
          Previous
        </Button>
        <Button
          size="small"
          aria-label="Next page"
          disabled={page * 20 >= total || history.query.isFetching}
          onClick={() => {
            setExpanded([]);
            setPage(page + 1);
          }}
        >
          Next
        </Button>
      </Stack>
    </Stack>
  );
}
