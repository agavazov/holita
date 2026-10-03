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
import { Fragment, useState } from 'react';
import { historyResource, type DataError } from '../../../data/data-provider.js';
import type {
  ListReferenceEventHistoryQuery,
  ReferenceEventHistoryOperation,
} from '../../../generated/graphql/operations.js';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';
import type { TranslationKey } from '../../../localization/dictionaries.js';
import { useLocalization } from '../../../localization/localization-provider.js';

type Entry = ListReferenceEventHistoryQuery['referenceEventHistory']['items'][number];

const operations: Record<ReferenceEventHistoryOperation, TranslationKey> = {
  CREATED: 'reference.events.operationCreated',
  UPDATED: 'reference.events.operationUpdated',
  TRASHED: 'reference.events.operationTrashed',
  RESTORED: 'reference.events.operationRestored',
  SESSION_CREATED: 'reference.events.operationSessionCreated',
  SESSION_UPDATED: 'reference.events.operationSessionUpdated',
  SESSION_DELETED: 'reference.events.operationSessionDeleted',
  SESSIONS_REORDERED: 'reference.events.operationSessionsReordered',
  MEDIA_ADDED: 'reference.events.operationMediaAdded',
  MEDIA_UPDATED: 'reference.events.operationMediaUpdated',
  MEDIA_REMOVED: 'reference.events.operationMediaRemoved',
  MEDIA_REORDERED: 'reference.events.operationMediaReordered',
  COVER_CHANGED: 'reference.events.operationCoverChanged',
};

const fields: Record<string, TranslationKey> = {
  title: 'reference.events.fieldTitle',
  code: 'reference.events.fieldCode',
  status: 'reference.events.fieldStatus',
  format: 'reference.events.fieldFormat',
  capacity: 'reference.events.fieldCapacity',
  budget: 'reference.events.fieldBudget',
  featured: 'reference.events.fieldFeatured',
  startsAt: 'reference.events.fieldStartsAt',
  endsAt: 'reference.events.fieldEndsAt',
  registrationOpensOn: 'reference.events.fieldRegistrationOpens',
  registrationClosesOn: 'reference.events.fieldRegistrationCloses',
  venue: 'reference.events.fieldVenue',
  tags: 'reference.events.fieldTags',
  meetingUrl: 'reference.events.fieldMeetingUrl',
  summary: 'reference.events.fieldSummary',
  descriptionHtml: 'reference.events.fieldDescription',
  room: 'reference.events.fieldRoom',
  speakers: 'reference.events.fieldSpeakers',
  sessionOrder: 'reference.events.fieldSessionOrder',
  galleryOrder: 'reference.events.fieldGalleryOrder',
  cover: 'reference.events.fieldCover',
  altText: 'reference.events.fieldAltText',
};

export function EventHistory({ storeId, eventId }: { storeId: string; eventId: string }) {
  const { t, formatDate } = useLocalization();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string[]>([]);
  const history = useList<Entry, DataError>({
    resource: historyResource(storeId, eventId),
    pagination: { currentPage: page, pageSize: 20, mode: 'server' },
    errorNotification: false,
  });
  const total = history.result.total ?? 0;

  return (
    <Stack component="section" aria-label={t('reference.events.history')} sx={{ gap: 3, minWidth: 0 }}>
      <Box>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          {t('reference.events.history')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('reference.events.historyHelp')}
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
              {t('common.retry')}
            </Button>
          }
        >
          {t('common.genericError')}
        </Alert>
      )}
      <TableContainer>
        <Table aria-label={t('reference.events.savedChanges')} sx={{ minWidth: 620 }}>
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
                  {t('reference.events.details')}
                </Box>
              </TableCell>
              <TableCell>{t('reference.events.change')}</TableCell>
              <TableCell>{t('reference.events.actor')}</TableCell>
              <TableCell>{t('reference.events.whenSofia')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.query.isPending || history.query.isError || !history.result.data.length ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center' }}>
                  {history.query.isPending
                    ? t('reference.events.loadingHistory')
                    : history.query.isError
                      ? t('reference.events.historyUnavailable')
                      : t('reference.events.noHistory')}
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
                          aria-label={
                            expanded.includes(entry.id)
                              ? t('reference.events.collapseRow')
                              : t('reference.events.expandRow')
                          }
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
                        {t(operations[entry.operation])}
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
                      {formatDate(entry.createdAt, {
                        dateStyle: 'medium',
                        timeStyle: 'medium',
                        timeZone: 'Europe/Sofia',
                      })}
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
                          {entry.changes.map((change) => {
                            const fieldKey = fields[change.field];

                            return (
                              <Box key={change.field}>
                                <Typography variant="subtitle2" color="text.primary">
                                  {fieldKey ? t(fieldKey) : change.field}
                                </Typography>
                                <Typography variant="body2">
                                  <Box component="span" color="text.secondary">
                                    {t('reference.events.before')}{' '}
                                  </Box>
                                  {change.before ?? '—'}
                                </Typography>
                                <Typography variant="body2">
                                  <Box component="span" color="text.secondary">
                                    {t('reference.events.after')}{' '}
                                  </Box>
                                  {change.after ?? '—'}
                                </Typography>
                              </Box>
                            );
                          })}
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
          {history.query.isPending
            ? t('common.loading')
            : t('reference.events.historyPage', { page, count: total })}
        </Typography>
        <Button
          size="small"
          aria-label={t('common.previousPage')}
          disabled={page === 1 || history.query.isFetching}
          onClick={() => {
            setExpanded([]);
            setPage(page - 1);
          }}
        >
          {t('common.previous')}
        </Button>
        <Button
          size="small"
          aria-label={t('common.nextPage')}
          disabled={page * 20 >= total || history.query.isFetching}
          onClick={() => {
            setExpanded([]);
            setPage(page + 1);
          }}
        >
          {t('common.next')}
        </Button>
      </Stack>
    </Stack>
  );
}
