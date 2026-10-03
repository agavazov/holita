import { useDelete, useOne } from '@refinedev/core';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useLocalization } from '../../../localization/localization-provider.js';
import { localizedErrorMessage } from '../../../localization/data-error.js';
import { localizedPath } from '../../../localization/locale.js';
import { PageHeader } from '../../../components/page-header.js';
import { QueryRefreshWarning } from '../../../components/query-refresh-warning.js';
import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { eventsResource, type DataError } from '../../../data/data-provider.js';
import type { ReferenceEventDetailsFragment } from '../../../generated/graphql/operations.js';
import { eventFormats, eventLink, eventListReturn, eventListReturnSearch, eventStatuses } from './event-list-state.js';
import { SessionList } from '../sessions/session-list.js';
import { EventSpeakers } from '../sessions/event-speakers.js';
import { safeDescriptionHtml } from './description-html.js';
import { EventGallery } from '../media/event-gallery.js';
import { EventHistory } from './event-history.js';
import { useEventActions } from './use-event-actions.js';

export function EventShow({
  storeId,
  onChanged,
  onDeleted,
}: {
  storeId: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { eventId } = useParams();
  const { locale, t, formatDate, formatNumber } = useLocalization();
  const { search } = useLocation();
  const navigate = useNavigate();
  const requestedTab = new URLSearchParams(search).get('tab');
  const resource = eventsResource(storeId);
  const listPath = eventListReturn(locale, resource, search);
  const listSearch = eventListReturnSearch(search);
  const event = useOne<ReferenceEventDetailsFragment, DataError>({
    resource,
    ...(eventId ? { id: eventId } : {}),
    meta: { includeDeleted: true },
    queryOptions: { enabled: Boolean(eventId) },
    errorNotification: false,
  });
  const actions = useEventActions();
  const deletion = useDelete<ReferenceEventDetailsFragment, DataError>();
  const [confirm, setConfirm] = useState(false);
  const submitting = useRef(false);
  const pending = actions.mutation.isPending || deletion.mutation.isPending;
  const row = event.result;
  const tab =
    requestedTab === 'history'
      ? 'history'
      : requestedTab === 'sessions' && !row?.deletedAt
        ? 'sessions'
        : 'overview';
  function changeEvent() {
    if (!row || submitting.current) return;
    submitting.current = true;
    actions.mutate(
      {
        url: resource,
        method: 'post',
        values: row.deletedAt
          ? { action: 'restore', ids: [row.id] }
          : {
              action: 'status',
              ids: [row.id],
              status: row.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED',
            },
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: onChanged,
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  function remove() {
    if (!row || submitting.current) return;
    submitting.current = true;
    deletion.mutate(
      {
        resource,
        id: row.id,
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          onDeleted();
          void navigate(listPath, { replace: true });
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  const breadcrumbs = [
    { label: t('common.home'), to: localizedPath(locale, '') },
    { label: t('shell.reference') },
    { label: t('reference.events.events'), to: listPath },
    { label: row?.title ?? t('reference.events.event') },
  ];
  if (!row)
    return (
      <Stack sx={{ flex: 1 }}>
        <PageHeader title={t('reference.events.event')} breadcrumbs={breadcrumbs} />
        <Paper sx={{ p: { xs: 3, md: 5 } }}>
          {event.query.isPending ? (
            <Skeleton variant="rounded" height={300} />
          ) : (
            <>
              <Alert
                severity="error"
                action={
                  <Button
                    onClick={() => {
                      void event.query.refetch();
                    }}
                  >
                    {t('common.retry')}
                  </Button>
                }
              >
                {t('reference.events.unavailable')}
              </Alert>
              <Button
                onClick={() => {
                  void navigate(listPath);
                }}
                sx={{ mt: 2 }}
              >
                {t('reference.events.back')}
              </Button>
            </>
          )}
        </Paper>
      </Stack>
    );
  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      {event.query.isRefetchError && (
        <QueryRefreshWarning
          message={t('common.genericError')}
          refreshing={event.query.isFetching}
          onRetry={() => {
            void event.query.refetch();
          }}
        />
      )}
      <PageHeader
        title={row.title}
        breadcrumbs={breadcrumbs}
        action={
          row.deletedAt ? (
            <Button variant="contained" loading={pending} onClick={changeEvent}>
              {t('reference.events.restoreEvent')}
            </Button>
          ) : (
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() => {
                  void navigate(eventLink(locale, resource, `${row.id}/edit`, listSearch));
                }}
              >
                {t('reference.events.edit')}
              </Button>
              <Button
                variant="soft"
                color="neutral"
                onClick={changeEvent}
                loading={actions.mutation.isPending}
                disabled={pending}
                aria-label={row.status === 'PUBLISHED' ? t('reference.events.archive') : t('reference.events.publish')}
                aria-busy={pending}
              >
                {row.status === 'PUBLISHED' ? t('reference.events.archive') : t('reference.events.publish')}
              </Button>
              <Button
                color="error"
                variant="soft"
                disabled={pending}
                onClick={() => {
                  deletion.mutation.reset();
                  setConfirm(true);
                }}
              >
                {t('reference.events.moveToTrash')}
              </Button>
            </Stack>
          )
        }
      />
      <Paper sx={{ px: { xs: 3, md: 5 }, pt: 3 }}>
        <Stack direction="row" sx={{ gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            color={row.status === 'PUBLISHED' ? 'success' : 'neutral'}
            label={t(eventStatuses.find(({ value }) => value === row.status)?.labelKey ?? 'reference.events.event')}
          />
          {row.deletedAt && <Chip color="warning" label={t('reference.events.inTrash')} />}
          {row.featured && <Chip color="info" label={t('reference.events.featured')} />}
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {row.code} · {formatDate(row.startsAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' })} ({t('reference.events.sofia')}) ·{' '}
            {row.venue?.name ?? t('reference.events.online')}
          </Typography>
        </Stack>
        <Tabs
          value={tab}
          aria-label={t('reference.events.details')}
          onChange={(_, next: string) => {
            const query = new URLSearchParams(search);
            if (next === 'overview') query.delete('tab');
            else query.set('tab', next);
            void navigate({ search: query.toString() ? `?${query.toString()}` : '' });
          }}
        >
          <Tab value="overview" label={t('reference.events.overview')} />
          <Tab value="sessions" label={t('reference.sessions')} disabled={Boolean(row.deletedAt)} />
          <Tab value="history" label={t('reference.events.history')} />
        </Tabs>
      </Paper>
      <Paper sx={{ p: { xs: 3, md: 5 }, outline: 0 }}>
        <Stack sx={{ gap: 3 }}>
          {actions.mutation.isError && (
            <Alert severity="error">{localizedErrorMessage(actions.mutation.error, t)}</Alert>
          )}
          {row.deletedAt && (
            <Alert severity="info">
              {t('reference.events.trashInfo')}
            </Alert>
          )}
          {tab === 'history' ? (
            <EventHistory storeId={storeId} eventId={row.id} />
          ) : tab === 'sessions' ? (
            <SessionList storeId={storeId} eventId={row.id} search={search} />
          ) : (
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              sx={{ gap: 3, alignItems: 'flex-start' }}
            >
              <Stack sx={{ flex: 1, minWidth: 0, width: '100%', gap: 3 }}>
                <Paper sx={{ outline: 0 }} component="section" aria-labelledby="event-about">
                  <Typography
                    id="event-about"
                    variant="h6"
                    component="h2"
                    sx={{ mb: 3, px: 2, py: 1, borderRadius: 2, bgcolor: 'background.elevation2' }}
                  >
                    {t('reference.events.about')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={row.summary ? 'text.primary' : 'text.secondary'}
                    sx={{ whiteSpace: 'pre-wrap' }}
                  >
                    {row.summary ?? t('reference.events.noSummary')}
                  </Typography>
                  {row.descriptionHtml && (
                    <Box
                      className="event-rich-content"
                      aria-label={t('reference.events.description')}
                      sx={{ my: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}
                      dangerouslySetInnerHTML={{ __html: safeDescriptionHtml(row.descriptionHtml) }}
                    />
                  )}
                  <Stack
                    direction="row"
                    sx={{ gap: 1, flexWrap: 'wrap', mt: row.tags.length ? 3 : 0 }}
                  >
                    {row.tags.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={`${tag.name}${tag.active ? '' : ` (${t('reference.inactive')})`}`}
                        variant="outlined"
                        icon={
                          <Box
                            component="span"
                            sx={{
                              bgcolor: tag.color,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              ml: 1.5,
                            }}
                          />
                        }
                      />
                    ))}
                  </Stack>
                </Paper>
                <Paper sx={{ outline: 0 }} component="section" aria-labelledby="event-schedule">
                  <Typography
                    id="event-schedule"
                    variant="h6"
                    component="h2"
                    sx={{ mb: 3, px: 2, py: 1, borderRadius: 2, bgcolor: 'background.elevation2' }}
                  >
                    {t('reference.events.scheduleLocation')}
                  </Typography>
                  <Stack component="dl" sx={{ m: 0, gap: 2 }}>
                    {[
                      [
                        t('reference.events.starts'),
                        `${formatDate(row.startsAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' })} · Europe/Sofia`,
                      ],
                      [
                        t('reference.events.ends'),
                        `${formatDate(row.endsAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' })} · Europe/Sofia`,
                      ],
                      [
                        t('reference.events.registration'),
                        row.registrationOpensOn && row.registrationClosesOn
                          ? `${row.registrationOpensOn} – ${row.registrationClosesOn}`
                          : t('reference.events.notConfigured'),
                      ],
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography component="dt" variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                          {value}
                        </Typography>
                      </Box>
                    ))}
                    {row.venue && (
                      <Box>
                        <Typography component="dt" variant="caption" color="text.secondary">
                          {t('reference.events.venue')}
                        </Typography>
                        <Box component="dd" sx={{ m: 0 }}>
                          <Typography variant="subtitle2">
                            {row.venue.name}
                            {!row.venue.active && ` (${t('reference.inactive')})`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {[row.venue.address, row.venue.city, row.venue.countryCode]
                              .filter(Boolean)
                              .join(', ')}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    {row.meetingUrl && (
                      <Box>
                        <Typography component="dt" variant="caption" color="text.secondary">
                          {t('reference.events.meetingLink')}
                        </Typography>
                        <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                          <Link
                            href={row.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                          >
                            {row.meetingUrl}
                          </Link>
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </Paper>
                {!row.deletedAt && <EventGallery storeId={storeId} eventId={row.id} />}
              </Stack>
              <Stack sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0, gap: 3 }}>
                <Paper
                  background={1}
                  sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, outline: 0 }}
                  component="aside"
                  aria-labelledby="event-record-details"
                >
                  <Typography id="event-record-details" variant="h6" component="h2" sx={{ mb: 3 }}>
                    {t('reference.events.details')}
                  </Typography>
                  <Stack component="dl" divider={<Divider />} sx={{ m: 0, gap: 2 }}>
                    {[
                      [t('reference.events.code'), row.code],
                      [t('reference.events.format'), t(eventFormats.find(({ value }) => value === row.format)?.labelKey ?? 'reference.events.event')],
                      [t('reference.events.capacity'), row.capacity == null ? t('reference.events.notSet') : formatNumber(row.capacity)],
                      [
                        t('reference.events.budget'),
                        row.budget
                          ? `${formatNumber(Number(row.budget), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
                          : t('reference.events.notSet'),
                      ],
                      [t('reference.events.featured'), row.featured ? t('common.yes') : t('common.no')],
                      [
                        t('reference.events.created'),
                        `${formatDate(row.createdAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' })} (${t('reference.events.sofia')})`,
                      ],
                      [
                        t('reference.events.updated'),
                        `${formatDate(row.updatedAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' })} (${t('reference.events.sofia')})`,
                      ],
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography component="dt" variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography
                          component="dd"
                          variant="body2"
                          sx={{ m: 0, overflowWrap: 'anywhere' }}
                        >
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
                {!row.deletedAt && <EventSpeakers storeId={storeId} eventId={row.id} />}
              </Stack>
            </Stack>
          )}
          <Button
            onClick={() => {
              void navigate(listPath);
            }}
            sx={{ alignSelf: 'flex-start' }}
            color="neutral"
          >
            {t('reference.events.back')}
          </Button>
        </Stack>
      </Paper>
      <Dialog
        open={confirm}
        fullWidth
        maxWidth="xs"
        aria-labelledby="event-trash-title"
        onClose={() => {
          if (!submitting.current) setConfirm(false);
        }}
      >
        <DialogTitle id="event-trash-title">{t('reference.events.trashTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('reference.events.trashMessage', { name: row.title })}
          </Typography>
          {deletion.mutation.isError && (
            <Alert severity="error">{localizedErrorMessage(deletion.mutation.error, t)}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={pending}
            onClick={() => {
              setConfirm(false);
            }}
          >
            {t('reference.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            loading={deletion.mutation.isPending}
            onClick={remove}
          >
            {t('reference.events.moveToTrash')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
