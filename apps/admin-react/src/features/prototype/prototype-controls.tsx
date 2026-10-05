import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['prototype', 'common']);
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
      setError(failure instanceof Error ? failure.message : t('prototype:reset.failed'));
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
          {t('prototype:browserHint')}
        </Typography>
        <Button
          variant="soft"
          color="neutral"
          disabled={pending}
          onClick={() => {
            setConfirming(true);
          }}
        >
          {t('prototype:actions.reset')}
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
        <DialogTitle id="prototype-reset-title">{t('prototype:confirmation.reset')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('prototype:reset.description')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={pending}
            loading={resetting}
            onClick={() => {
              void reset();
            }}
          >
            {t('prototype:reset.submit')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
