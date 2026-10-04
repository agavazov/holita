import { useCustomMutation, useInvalidate } from '@refinedev/core';
import { useEffect, useRef, useState } from 'react';
import { DataError } from '../../../data/data-error.js';
import type { MediaAction, MediaResult } from '../../../data/media-provider.js';
import { directUpload } from '../../../data/direct-upload.js';
import type { TranslationKey } from '../../../localization/dictionaries.js';

type MediaUploadError =
  | {
      key: Extract<
        TranslationKey,
        'reference.invalidImage' | 'reference.noUploadTarget' | 'reference.uploadFailed'
      >;
    }
  | { cause: DataError };

const missingUploadTarget = new Error('Missing upload target');

export function useMediaMutation() {
  const invalidate = useInvalidate();
  return useCustomMutation<MediaResult, DataError, MediaAction>({
    mutationOptions: {
      onSuccess: async (_result, variables) => {
        if (variables.values.action !== 'intent')
          await invalidate({ resource: variables.url, invalidates: ['list'] });
      },
    },
  });
}
export function useMediaUpload(resource: string) {
  const mutation = useMediaMutation();
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ name: string; percent: number; finishing: boolean } | null>(
    null,
  );
  const [error, setError] = useState<MediaUploadError | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  async function upload(file: File) {
    if (active.current) return;
    setError(null);
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024
    ) {
      setError({ key: 'reference.invalidImage' });
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setState({ name: file.name, percent: 0, finishing: false });
    try {
      const response = await mutation.mutateAsync({
        url: resource,
        method: 'post',
        values: {
          action: 'intent',
          input: { originalName: file.name, byteSize: file.size, contentType: file.type },
        },
        successNotification: false,
        errorNotification: false,
      });
      controller.signal.throwIfAborted();
      if (!('intent' in response.data)) throw missingUploadTarget;
      await directUpload(response.data.intent, file, controller.signal, (percent) => {
        if (!controller.signal.aborted) setState({ name: file.name, percent, finishing: false });
      });
      controller.signal.throwIfAborted();
      setState({ name: file.name, percent: 100, finishing: true });
      await mutation.mutateAsync({
        url: resource,
        method: 'post',
        values: { action: 'finalize', uploadId: response.data.intent.uploadId },
        successNotification: false,
        errorNotification: false,
      });
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(
          failure === missingUploadTarget
            ? { key: 'reference.noUploadTarget' }
            : failure instanceof DataError
              ? { cause: failure }
              : { key: 'reference.uploadFailed' },
        );
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (!controller.signal.aborted) setState(null);
      }
    }
  }
  return {
    upload,
    state,
    error,
    cancel: () => {
      active.current?.abort();
      active.current = null;
      setState(null);
    },
  };
}
