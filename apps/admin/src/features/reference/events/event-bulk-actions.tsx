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
            `${confirmation.label} completed for ${String(confirmation.values.ids.length)} ${confirmation.values.ids.length === 1 ? 'event' : 'events'}.`,
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
        aria-label="Selected event actions"
      >
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {ids.length} selected on this page
        </Typography>
        {trashed ? (
          <Button
            disabled={pending}
            onClick={() => {
              confirm('Restore', { action: 'restore', ids });
            }}
          >
            Restore selected
          </Button>
        ) : (
          <>
            <Button
              disabled={pending}
              onClick={() => {
                confirm('Publish', { action: 'status', status: 'PUBLISHED', ids });
              }}
            >
              Publish selected
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                confirm('Archive', { action: 'status', status: 'ARCHIVED', ids });
              }}
            >
              Archive selected
            </Button>
            <Button
              color="error"
              variant="soft"
              disabled={pending}
              onClick={() => {
                confirm('Move to trash', { action: 'trash', ids });
              }}
            >
              Trash selected
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
          {confirmation?.label ?? 'Update'} selected events?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This applies to {confirmation?.values.ids.length} selected{' '}
            {confirmation?.values.ids.length === 1 ? 'event' : 'events'}. All selected events must
            be eligible; otherwise none will change.
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
            Cancel
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
