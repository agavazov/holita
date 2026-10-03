import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useIsMutating } from '@tanstack/react-query';
import { useRef, useState } from 'react';

export function PrototypeControls({ onReset }: { onReset: () => void | Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const submitting = useRef(false);
  const pending = useIsMutating() > 0 || resetting;
  async function reset() {
    if (submitting.current || pending) return;
    submitting.current = true;
    setError('');
    setResetting(true);
    try {
      await onReset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Demo data could not be reset.');
      setConfirming(false);
    } finally {
      submitting.current = false;
      setResetting(false);
    }
  }
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          px: { xs: 3, md: 5 },
          py: 1.5,
          gap: 1,
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Prototype changes are saved in this browser.
        </Typography>
        <Button
          variant="soft"
          color="neutral"
          disabled={pending}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Reset demo data
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
      <Dialog
        open={confirming}
        onClose={() => {
          if (!pending) setConfirming(false);
        }}
        aria-labelledby="prototype-reset-title"
      >
        <DialogTitle id="prototype-reset-title">Reset demo data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Restore the initial prototype data and return to store selection. Saved changes and
            unsaved forms and uploaded images will be discarded.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={pending}
            loading={resetting}
            onClick={() => {
              void reset();
            }}
          >
            Reset data
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
