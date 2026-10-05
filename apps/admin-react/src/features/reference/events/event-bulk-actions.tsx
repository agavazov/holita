import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import type { EventAction } from '../../../data/events-provider.js';
import { useEventActions } from './use-event-actions.js';

export function EventBulkActions({
  resource,
  ids,
  trashed,
  onComplete,
}: {
  resource: string;
  ids: string[];
  trashed: boolean;
  onComplete: (message: string) => void;
}) {
  const { t } = useTranslation(['reference', 'common']);
  const actions = useEventActions();
  const submitting = useRef(false);
  const [confirmation, setConfirmation] = useState<{ label: string; values: EventAction }>();
  const pending = actions.mutation.isPending;
  function confirm(label: string, values: EventAction) {
    actions.mutation.reset();
    setConfirmation({ label, values });
  }
  function submit() {
    if (!confirmation || submitting.current) return;
    submitting.current = true;
    actions.mutate(
      {
        url: resource,
        method: 'post',
        values: confirmation.values,
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setConfirmation(undefined);
          onComplete(
            t('reference:events.bulk.completed', {
              action: confirmation.label,
              count: confirmation.values.ids.length,
            }),
          );
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  if (!ids.length && !confirmation) return null;
  return (
    <>
      <Stack
        direction="row"
        sx={{
          mb: 2,
          p: 1.5,
          bgcolor: 'background.elevation1',
          borderRadius: 2,
          gap: 1,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
        aria-label={t('reference:events.bulk.label')}
      >
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {t('common:selected', { count: ids.length })}
        </Typography>
        {trashed ? (
          <Button
            disabled={pending}
            onClick={() => {
              confirm(t('reference:events.actions.restore'), { action: 'restore', ids });
            }}
          >
            {t('reference:events.actions.restoreSelected')}
          </Button>
        ) : (
          <>
            <Button
              disabled={pending}
              onClick={() => {
                confirm(t('reference:events.actions.publish'), {
                  action: 'status',
                  status: 'PUBLISHED',
                  ids,
                });
              }}
            >
              {t('reference:events.actions.publishSelected')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                confirm(t('reference:events.actions.archive'), {
                  action: 'status',
                  status: 'ARCHIVED',
                  ids,
                });
              }}
            >
              {t('reference:events.actions.archiveSelected')}
            </Button>
            <Button
              color="error"
              variant="soft"
              disabled={pending}
              onClick={() => {
                confirm(t('reference:events.actions.trash'), { action: 'trash', ids });
              }}
            >
              {t('reference:events.actions.trashSelected')}
            </Button>
          </>
        )}
      </Stack>
      <Dialog
        open={Boolean(confirmation)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="event-bulk-title"
        onClose={() => {
          if (!submitting.current) setConfirmation(undefined);
        }}
      >
        <DialogTitle id="event-bulk-title">
          {t('reference:events.bulk.title', {
            action: confirmation?.label ?? t('reference:events.actions.update'),
          })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('reference:events.bulk.description', {
              count: confirmation?.values.ids.length ?? 0,
            })}
          </Typography>
          {actions.mutation.isError && (
            <Alert severity="error">{actions.mutation.error.message}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={pending}
            onClick={() => {
              setConfirmation(undefined);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="contained"
            color={confirmation?.values.action === 'trash' ? 'error' : 'primary'}
            loading={pending}
            onClick={submit}
          >
            {confirmation?.label}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
