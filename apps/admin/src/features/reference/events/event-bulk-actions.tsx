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
import type { TranslationKey } from '../../../localization/dictionaries.js';
import { useLocalization } from '../../../localization/localization-provider.js';
import { useEventActions } from './use-event-actions.js';

type Confirmation = {
  labelKey: TranslationKey;
  values: EventAction;
};

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
  const { t } = useLocalization();
  const actions = useEventActions();
  const submitting = useRef(false);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const pending = actions.mutation.isPending;

  function confirm(labelKey: TranslationKey, values: EventAction) {
    actions.mutation.reset();
    setConfirmation({ labelKey, values });
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
            t('reference.events.bulkCompleted', {
              action: t(confirmation.labelKey),
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
        aria-label={t('reference.events.selectedActions')}
      >
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {t('reference.events.selected', { count: ids.length })}
        </Typography>
        {trashed ? (
          <Button
            disabled={pending}
            onClick={() => {
              confirm('reference.events.restore', { action: 'restore', ids });
            }}
          >
            {t('reference.events.restoreSelected')}
          </Button>
        ) : (
          <>
            <Button
              disabled={pending}
              onClick={() => {
                confirm('reference.events.publish', {
                  action: 'status',
                  status: 'PUBLISHED',
                  ids,
                });
              }}
            >
              {t('reference.events.publishSelected')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                confirm('reference.events.archive', {
                  action: 'status',
                  status: 'ARCHIVED',
                  ids,
                });
              }}
            >
              {t('reference.events.archiveSelected')}
            </Button>
            <Button
              color="error"
              variant="soft"
              disabled={pending}
              onClick={() => {
                confirm('reference.events.moveToTrash', { action: 'trash', ids });
              }}
            >
              {t('reference.events.trashSelected')}
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
          {t('reference.events.bulkTitle', {
            action: confirmation ? t(confirmation.labelKey) : t('reference.events.update'),
          })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('reference.events.bulkMessage', {
              count: confirmation?.values.ids.length ?? 0,
            })}
          </Typography>
          {actions.mutation.isError && (
            <Alert severity="error">{t('common.genericError')}</Alert>
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
            {t('products.cancel')}
          </Button>
          <Button
            variant="contained"
            color={confirmation?.values.action === 'trash' ? 'error' : 'primary'}
            loading={pending}
            onClick={submit}
          >
            {confirmation ? t(confirmation.labelKey) : t('reference.events.update')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
