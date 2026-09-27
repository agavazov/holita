import { useRef, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import { Modal } from 'antd';

export function useUnsavedChanges(pending: boolean, additionalDirty = false) {
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
      <Modal
        title="Discard unsaved changes?"
        open={blocker.state === 'blocked'}
        okText="Discard changes"
        cancelText="Keep editing"
        okButtonProps={{ danger: true }}
        onOk={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        Your changes have not been saved. Leave this form?
      </Modal>
    ),
  };
}
