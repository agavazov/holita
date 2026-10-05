import { useFormat } from '../../../i18n/use-format.js';
import { useTranslation } from 'react-i18next';
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

type Entry = ListReferenceEventHistoryQuery['referenceEventHistory']['items'][number];
export function EventHistory({ storeId, eventId }: { storeId: string; eventId: string }) {
  const { t } = useTranslation(['reference', 'common']);
  const format = useFormat();
  const operations: Record<ReferenceEventHistoryOperation, string> = {
    CREATED: t('reference:history.operations.CREATED'),
    UPDATED: t('reference:history.operations.UPDATED'),
    TRASHED: t('reference:history.operations.TRASHED'),
    RESTORED: t('reference:history.operations.RESTORED'),
    SESSION_CREATED: t('reference:history.operations.SESSION_CREATED'),
    SESSION_UPDATED: t('reference:history.operations.SESSION_UPDATED'),
    SESSION_DELETED: t('reference:history.operations.SESSION_DELETED'),
    SESSIONS_REORDERED: t('reference:history.operations.SESSIONS_REORDERED'),
    MEDIA_ADDED: t('reference:history.operations.MEDIA_ADDED'),
    MEDIA_UPDATED: t('reference:history.operations.MEDIA_UPDATED'),
    MEDIA_REMOVED: t('reference:history.operations.MEDIA_REMOVED'),
    MEDIA_REORDERED: t('reference:history.operations.MEDIA_REORDERED'),
    COVER_CHANGED: t('reference:history.operations.COVER_CHANGED'),
  };
  const fields: Record<string, string> = {
    title: t('reference:fields.title'),
    code: t('reference:fields.code'),
    status: t('common:status.label'),
    format: t('reference:fields.format'),
    capacity: t('reference:fields.capacity'),
    budget: t('reference:fields.budgetEur'),
    featured: t('reference:fields.featured'),
    startsAt: t('reference:history.fields.startUtc'),
    endsAt: t('reference:history.fields.endUtc'),
    registrationOpensOn: t('reference:fields.registrationOpens'),
    registrationClosesOn: t('reference:fields.registrationCloses'),
    venue: t('reference:fields.venue'),
    tags: t('reference:tags.title'),
    meetingUrl: t('reference:history.fields.meetingLink'),
    summary: t('common:summary'),
    descriptionHtml: t('reference:history.fields.description'),
    room: t('reference:fields.room'),
    speakers: t('reference:speakers.title'),
    sessionOrder: t('reference:history.fields.sessionOrder'),
    galleryOrder: t('reference:history.fields.galleryOrder'),
    cover: t('reference:media.cover'),
    altText: t('reference:history.fields.altText'),
  };
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string[]>([]);
  const history = useList<Entry, DataError>({
    resource: historyResource(storeId, eventId),
    pagination: { currentPage: page, pageSize: 20, mode: 'server' },
    errorNotification: false,
  });
  const total = history.result.total ?? 0;
  return (
    <Stack
      component="section"
      aria-label={t('reference:history.label')}
      sx={{ gap: 3, minWidth: 0 }}
    >
      <Box>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          {t('reference:history.label')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('reference:history.description')}
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
              {t('common:actions.retry')}
            </Button>
          }
        >
          {history.query.error.message}
        </Alert>
      )}
      <TableContainer>
        <Table aria-label={t('reference:history.table')} sx={{ minWidth: 620 }}>
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
                  {t('reference:history.details')}
                </Box>
              </TableCell>
              <TableCell>{t('reference:history.change')}</TableCell>
              <TableCell>{t('reference:history.actor')}</TableCell>
              <TableCell>{t('reference:history.when')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.query.isPending || history.query.isError || !history.result.data.length ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center' }}>
                  {history.query.isPending
                    ? t('reference:history.loading')
                    : history.query.isError
                      ? t('reference:history.unavailable')
                      : t('reference:history.empty')}
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
                              ? t('reference:history.collapse')
                              : t('reference:history.expand')
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
                      {format.historyTime(entry.createdAt)}
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
                                  {t('reference:history.before')}{' '}
                                </Box>
                                {change.before ?? '—'}
                              </Typography>
                              <Typography variant="body2">
                                <Box component="span" color="text.secondary">
                                  {t('reference:history.after')}{' '}
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
          {history.query.isPending
            ? t('common:loading')
            : t('reference:history.page', {
                page: format.number(page),
                total: format.number(total),
              })}
        </Typography>
        <Button
          size="small"
          aria-label={t('common:pagination.previousPage')}
          disabled={page === 1 || history.query.isFetching}
          onClick={() => {
            setExpanded([]);
            setPage(page - 1);
          }}
        >
          {t('common:pagination.previous')}
        </Button>
        <Button
          size="small"
          aria-label={t('common:pagination.nextPage')}
          disabled={page * 20 >= total || history.query.isFetching}
          onClick={() => {
            setExpanded([]);
            setPage(page + 1);
          }}
        >
          {t('common:pagination.next')}
        </Button>
      </Stack>
    </Stack>
  );
}
