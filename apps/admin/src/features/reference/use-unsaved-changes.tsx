import { useId, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { localeFromPathname } from '../../localization/locale.js';
import { useLocalization } from '../../localization/localization-provider.js';

export function useUnsavedChanges(pending: boolean, additionalDirty = false) {
  const id = useId();
  const { t } = useLocalization();
  const [dirty, setDirty] = useState(false);
  const saved = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const locationChanged =
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search ||
      currentLocation.hash !== nextLocation.hash;
    const localeChanged =
      localeFromPathname(currentLocation.pathname) !== localeFromPathname(nextLocation.pathname);

    return (
      locationChanged &&
      ((pending && localeChanged) ||
        (!pending && (dirty || additionalDirty) && !saved.current))
    );
  });
  useBeforeUnload((event) => {
    if (pending || ((dirty || additionalDirty) && !saved.current)) {
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
        <DialogTitle id={id}>
          {t(pending ? 'common.pendingTitle' : 'common.unsavedTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(pending ? 'common.pendingMessage' : 'common.unsavedMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="neutral" autoFocus onClick={() => blocker.reset?.()}>
            {t('common.stay')}
          </Button>
          {!pending && (
            <Button variant="contained" color="error" onClick={() => blocker.proceed?.()}>
              {t('common.leave')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    ),
  };
}
