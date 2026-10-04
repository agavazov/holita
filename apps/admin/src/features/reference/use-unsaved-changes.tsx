import { useId, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker, useLocation } from 'react-router';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  localeFromPathname,
  pathWithoutLocale,
} from '../../localization/locale.js';
import {
  useLocalization,
  useLocaleSwitchPending,
} from '../../localization/localization-provider.js';

export function useUnsavedChanges(pending: boolean, additionalDirty = false) {
  const id = useId();
  const location = useLocation();
  const { t } = useLocalization();
  useLocaleSwitchPending(pending);
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
  const localeOnlyChange =
    blocker.state === 'blocked' &&
    localeFromPathname(location.pathname) !== localeFromPathname(blocker.location.pathname) &&
    pathWithoutLocale(location.pathname) === pathWithoutLocale(blocker.location.pathname) &&
    location.search === blocker.location.search &&
    location.hash === blocker.location.hash;
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
          {t(
            pending
              ? 'common.pendingTitle'
              : localeOnlyChange
                ? 'common.languageChangeTitle'
                : 'common.unsavedTitle',
          )}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(
              pending
                ? 'common.pendingMessage'
                : localeOnlyChange
                  ? 'common.languageChangeMessage'
                  : 'common.unsavedMessage',
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="neutral" autoFocus onClick={() => blocker.reset?.()}>
            {t(localeOnlyChange ? 'common.keepLanguage' : 'common.stay')}
          </Button>
          {!pending && (
            <Button
              variant="contained"
              color={localeOnlyChange ? 'primary' : 'error'}
              onClick={() => blocker.proceed?.()}
            >
              {t(localeOnlyChange ? 'common.changeLanguage' : 'common.leave')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    ),
  };
}
