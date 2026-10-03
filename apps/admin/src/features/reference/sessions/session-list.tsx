import { useDelete, useList } from '@refinedev/core';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { RecordActions } from '../../../components/record-actions.js';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';
import { useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { sessionsResource, type DataError } from '../../../data/data-provider.js';
import type { ReferenceSessionDetailsFragment } from '../../../generated/graphql/operations.js';
import { useLocalization } from '../../../localization/localization-provider.js';
import { localizedPath } from '../../../localization/locale.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { useSessionOrder } from './use-session-order.js';

export function SessionList({
  storeId,
  eventId,
  search,
}: {
  storeId: string;
  eventId: string;
  search: string;
}) {
  const navigate = useNavigate();
  const { locale, t, formatDate } = useLocalization();
  const resource = sessionsResource(storeId, eventId);
  const sessions = useList<ReferenceSessionDetailsFragment, DataError>({
    resource,
    pagination: { mode: 'off' },
    errorNotification: false,
  });
  const [draft, setDraft] = useState<ReferenceSessionDetailsFragment[] | null>(null);
  const [deleting, setDeleting] = useState<ReferenceSessionDetailsFragment | null>(null);
  const [reloading, setReloading] = useState(false);
  const [notice, setNotice] = useState('');
  const order = useSessionOrder();
  const deletion = useDelete<ReferenceSessionDetailsFragment, DataError>();
  const submitting = useRef(false);
  const pending = order.mutation.isPending || deletion.mutation.isPending || reloading;
  const changes = useUnsavedChanges(pending, Boolean(draft));
  const rows = draft ?? sessions.result.data;
  function move(id: string, targetId: string) {
    if (pending || id === targetId) return;
    const from = rows.findIndex((row) => row.id === id),
      to = rows.findIndex((row) => row.id === targetId);
    const row = rows[from];
    if (!row || to < 0) return;
    const next = rows.filter((item) => item.id !== id);
    next.splice(to, 0, row);
    const unchanged = next.every((item, i) => item.id === sessions.result.data[i]?.id);
    setDraft(unchanged ? null : next);
    setNotice(t('reference.sessionMoved', { title: row.title, position: to + 1 }));
    order.mutation.reset();
  }
  function save() {
    if (!draft || submitting.current) return;
    submitting.current = true;
    order.mutate(
      {
        url: resource,
        method: 'post',
        values: { ids: draft.map((row) => row.id) },
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setDraft(null);
          setNotice(t('reference.sessionOrderSaved'));
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  async function cancel() {
    if (submitting.current) return;
    submitting.current = true;
    setReloading(true);
    const response = await sessions.query.refetch();
    if (response.isSuccess) {
      setDraft(null);
      order.mutation.reset();
      setNotice(t('reference.serverOrderRestored'));
    }
    setReloading(false);
    submitting.current = false;
  }
  function remove() {
    if (!deleting || submitting.current) return;
    submitting.current = true;
    deletion.mutate(
      {
        resource,
        id: deleting.id,
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setDeleting(null);
          setNotice(t('reference.sessionDeleted'));
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  return (
    <Stack component="section" aria-label={t('reference.eventProgram')} sx={{ gap: 3 }}>
      {changes.dialog}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant="h6" component="h2">
            {t('reference.sessions')}
          </Typography>
          <Chip size="small" label={`${String(sessions.result.total ?? 0)} / 100`} />
        </Stack>
        <Button
          variant="contained"
          startIcon={<span aria-hidden="true">+</span>}
          disabled={pending || Boolean(draft) || rows.length >= 100}
          onClick={() => {
            void navigate(`${localizedPath(locale, `${resource}/create`)}${search}`);
          }}
        >
          {t('reference.addSession')}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {t('reference.programHelp')}
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="body2" color={draft ? 'warning.main' : 'text.secondary'}>
          {draft
            ? t('reference.unsavedOrder')
            : t('reference.sessionSeparateSave')}
        </Typography>
        <Stack direction="row" sx={{ gap: 1, flexShrink: 0 }}>
          <Button
            variant="soft"
            color="neutral"
            onClick={() => {
              void cancel();
            }}
            disabled={!draft || pending}
            loading={reloading}
            aria-label={t('reference.cancelOrder')}
          >
            {t('reference.cancelOrder')}
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={!draft || pending}
            loading={order.mutation.isPending}
            aria-label={t('reference.saveOrder')}
            aria-busy={order.mutation.isPending}
          >
            {t('reference.saveOrder')}
          </Button>
        </Stack>
      </Stack>
      {(sessions.query.error || order.mutation.error) && (
        <Alert
          severity="error"
          action={
            !draft && (
              <Button
                onClick={() => {
                  void sessions.query.refetch();
                }}
              >
                Retry
              </Button>
            )
          }
        >
          {t('common.genericError')}
        </Alert>
      )}
      <Typography
        role="status"
        aria-live="polite"
        variant="body2"
        color="text.secondary"
        sx={{ '&:empty': { display: 'none' } }}
      >
        {notice}
      </Typography>
      {sessions.query.isPending ? (
        <Skeleton variant="rounded" height={180} />
      ) : !rows.length && !sessions.query.isError ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('reference.noSessions')}
        </Typography>
      ) : (
        <Stack
          component="ol"
          aria-label={t('reference.eventSessions')}
          sx={{ listStyle: 'none', p: 0, m: 0, gap: 3 }}
        >
          {rows.map((row, index) => (
            <Paper
              key={row.id}
              component="li"
              background={1}
              aria-label={row.title}
              draggable={!pending}
              sx={{
                p: 3,
                borderRadius: 6,
                outline: 0,
                display: 'flex',
                gap: { xs: 1, sm: 3 },
                alignItems: 'flex-start',
                cursor: pending || draft ? 'default' : 'pointer',
              }}
              onClick={(e) => {
                if (
                  !pending &&
                  !draft &&
                  e.target instanceof HTMLElement &&
                  !e.target.closest('button,a')
                )
                  void navigate(`${localizedPath(locale, `${resource}/${row.id}/edit`)}${search}`);
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', row.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!pending) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                move(e.dataTransfer.getData('text/plain'), row.id);
              }}
            >
              <Stack sx={{ alignItems: 'center', gap: 0.5 }}>
                <IconifyIcon
                  icon="material-symbols:drag-indicator"
                  sx={{
                    fontSize: 20,
                    color: 'text.secondary',
                    cursor: pending ? 'default' : 'grab',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {index + 1}
                </Typography>
                <Button
                  shape="square"
                  size="small"
                  color="neutral"
                  aria-label={t('reference.moveUp', { title: row.title })}
                  disabled={pending || index === 0}
                  onClick={() => {
                    const target = rows[index - 1];
                    if (target) move(row.id, target.id);
                  }}
                >
                  <span aria-hidden="true">↑</span>
                </Button>
                <Button
                  shape="square"
                  size="small"
                  color="neutral"
                  aria-label={t('reference.moveDown', { title: row.title })}
                  disabled={pending || index === rows.length - 1}
                  onClick={() => {
                    const target = rows[index + 1];
                    if (target) move(row.id, target.id);
                  }}
                >
                  <span aria-hidden="true">↓</span>
                </Button>
              </Stack>
              <Box sx={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                  <Link
                    component={RouterLink}
                    color="text.primary"
                    underline="hover"
                    to={`${localizedPath(locale, `${resource}/${row.id}/edit`)}${search}`}
                    aria-disabled={pending || Boolean(draft)}
                    onClick={(e) => {
                      if (pending || draft) e.preventDefault();
                    }}
                  >
                    {row.title}
                  </Link>
                </Typography>
                <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(row.startsAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' })} –{' '}
                    {formatDate(row.endsAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' })} (Sofia)
                  </Typography>
                  {row.room && <Chip size="small" label={row.room} />}
                </Stack>
                {row.summary && (
                  <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                    {row.summary}
                  </Typography>
                )}
                <Stack direction="row" sx={{ mt: 2, gap: 1, flexWrap: 'wrap' }}>
                  {row.speakers.length ? (
                    row.speakers.map((speaker) => (
                      <Chip
                        key={speaker.id}
                        size="small"
                        label={`${speaker.name}${speaker.active ? '' : ` (${t('reference.inactiveSuffix')})`}`}
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('reference.noSpeakers')}
                    </Typography>
                  )}
                </Stack>
              </Box>
              <RecordActions
                name={row.title}
                tabIndex={0}
                disabled={pending || Boolean(draft)}
                onEdit={() => {
                  void navigate(`${localizedPath(locale, `${resource}/${row.id}/edit`)}${search}`);
                }}
                onDelete={() => {
                  deletion.mutation.reset();
                  setDeleting(row);
                }}
              />
            </Paper>
          ))}
        </Stack>
      )}
      <Dialog
        open={Boolean(deleting)}
        onClose={() => {
          if (!pending) setDeleting(null);
        }}
        aria-labelledby="delete-session-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="delete-session-title">{t('reference.deleteSessionTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('reference.deleteSessionMessage', { title: deleting?.title ?? '' })}</Typography>
          {deletion.mutation.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('common.genericError')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={pending}
            onClick={() => {
              setDeleting(null);
            }}
          >
            {t('reference.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deletion.mutation.isPending}
            onClick={remove}
          >
            {t('reference.deleteSession')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
