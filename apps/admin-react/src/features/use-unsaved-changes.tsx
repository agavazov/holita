import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBeforeUnload, useBlocker } from 'react-router';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

export function useUnsavedChanges(pending: boolean, additionalDirty = false) {
  const { t } = useTranslation('common');
  const id = useId();
  const [dirty, setDirty] = useState(false);
  const saved = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || additionalDirty) &&
      !pending &&
      !saved.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  useBeforeUnload((event) => {
    if ((dirty || additionalDirty) && !pending && !saved.current) {
      event.preventDefault();
    }
  });
  return {
    dirty: dirty || additionalDirty,
    changed: () => {
      saved.current = false;
      setDirty(true);
    },
    saved: () => {
      saved.current = true;
      setDirty(false);
    },
    dialog: (
      <Dialog
        aria-labelledby={id}
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
      >
        <DialogTitle id={id}>{t('unsaved.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('unsaved.description')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="neutral" autoFocus onClick={() => blocker.reset?.()}>
            {t('actions.keepEditing')}
          </Button>
          <Button variant="contained" color="error" onClick={() => blocker.proceed?.()}>
            {t('actions.discardChanges')}
          </Button>
        </DialogActions>
      </Dialog>
    ),
  };
}
