import { useDelete } from '@refinedev/core';
import { useCallback, useRef, useState } from 'react';
import type { DataError } from '../data/data-provider.js';

type RecordTarget = { id: string; name: string };
type Failure = RecordTarget & { message: string };

// Products and lookup lists delete individually; Events retain their atomic lifecycle actions.
export function useRecordDeletion(
  resource: string,
  onComplete: (deleted: number, failedIds: string[]) => void,
) {
  const deletion = useDelete<{ id: string }, DataError>();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [targets, setTargets] = useState<RecordTarget[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const confirm = useCallback((rows: RecordTarget[]) => {
    if (submitting.current) return;
    setFailures([]);
    setTargets(rows);
  }, []);
  function cancel() {
    if (!submitting.current) setTargets([]);
  }
  function remove() {
    if (!targets.length || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFailures([]);
    const failed: Failure[] = [];
    let deleted = 0;
    // Per-call callbacks stop unsent requests and local effects when this list unmounts.
    function next(index: number) {
      const record = targets[index];
      if (!record) {
        submitting.current = false;
        setPending(false);
        setTargets(failed);
        setFailures(failed);
        onComplete(
          deleted,
          failed.map(({ id }) => id),
        );
        return;
      }
      deletion.mutate(
        {
          resource,
          id: record.id,
          mutationMode: 'pessimistic',
          successNotification: false,
          errorNotification: false,
        },
        {
          onSuccess: () => {
            deleted += 1;
          },
          onError: (error) => {
            failed.push({ id: record.id, name: record.name, message: error.message });
          },
          onSettled: () => {
            next(index + 1);
          },
        },
      );
    }
    next(0);
  }
  return { targets, failures, pending, confirm, cancel, remove };
}
