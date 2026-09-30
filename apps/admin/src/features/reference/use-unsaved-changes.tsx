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

export function useUnsavedChanges(pending: boolean, additionalDirty = false) {
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
        <DialogTitle id={id}>Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <DialogContentText>Your changes have not been saved. Leave this form?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="neutral" autoFocus onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
          <Button variant="contained" color="error" onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    ),
  };
}
