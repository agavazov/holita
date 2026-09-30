import { useDelete, useList, useUpdate } from '@refinedev/core';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';

import { useEffect, useRef, useState } from 'react';
import { mediaResource, type DataError } from '../../../data/data-provider.js';
import type {
  ReferenceEventMediaDetailsFragment,
  UpdateReferenceEventMediaInput,
} from '../../../generated/graphql/operations.js';
import { useMediaMutation, useMediaUpload } from './use-media-actions.js';

type Props = {
  storeId: string;
  eventId: string;
  editable?: boolean;
  disabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
};
export function EventGallery({
  storeId,
  eventId,
  editable = false,
  disabled = false,
  onDirtyChange,
  onPendingChange,
}: Props) {
  const resource = mediaResource(storeId, eventId);
  const gallery = useList<ReferenceEventMediaDetailsFragment, DataError>({
    resource,
    pagination: { mode: 'off' },
    errorNotification: false,
    queryOptions: { refetchInterval: 8 * 60_000 },
  });
  const upload = useMediaUpload(resource);
  const action = useMediaMutation();
  const update = useUpdate<
    ReferenceEventMediaDetailsFragment,
    DataError,
    UpdateReferenceEventMediaInput
  >();
  const deletion = useDelete<ReferenceEventMediaDetailsFragment, DataError>();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<ReferenceEventMediaDetailsFragment | null>(null);
  const [altText, setAltText] = useState('');
  const [deleting, setDeleting] = useState<ReferenceEventMediaDetailsFragment | null>(null);
  const [reloading, setReloading] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pending =
    Boolean(upload.state) ||
    action.mutation.isPending ||
    update.mutation.isPending ||
    deletion.mutation.isPending ||
    reloading;
  useEffect(() => {
    onDirtyChange?.(Boolean(draft));
  }, [draft, onDirtyChange]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  const locked = disabled || pending;
  const rows = draft
    ? draft.flatMap((id) => gallery.result.data.filter((row) => row.id === id))
    : gallery.result.data;
  const error =
    action.mutation.error?.message ??
    update.mutation.error?.message ??
    deletion.mutation.error?.message ??
    upload.error;
  function move(id: string, target: string) {
    if (locked || id === target) return;
    const next = rows.map((row) => row.id),
      from = next.indexOf(id),
      to = next.indexOf(target);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, id);
    setDraft(next.every((value, index) => value === gallery.result.data[index]?.id) ? null : next);
    action.mutation.reset();
    setNotice(`Image moved to position ${String(to + 1)}. Save order to keep this change.`);
  }
  function mutate(values: { action: 'cover'; id: string } | { action: 'reorder'; ids: string[] }) {
    if (submitting.current || locked) return;
    submitting.current = true;
    action.mutate(
      {
        url: resource,
        method: 'post',
        values,
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          if (values.action === 'reorder') setDraft(null);
          setNotice(values.action === 'cover' ? 'Cover saved.' : 'Gallery order saved.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  async function cancelOrder() {
    if (submitting.current || locked) return;
    submitting.current = true;
    setReloading(true);
    const response = await gallery.query.refetch();
    if (!mounted.current) return;
    if (response.isSuccess) {
      setDraft(null);
      action.mutation.reset();
      setNotice('Saved gallery order restored.');
    }
    setReloading(false);
    submitting.current = false;
  }
  function saveAlt() {
    if (!editing || submitting.current || locked) return;
    submitting.current = true;
    update.mutate(
      {
        resource,
        id: editing.id,
        values: { altText: altText.trim() || null },
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setEditing(null);
          setNotice('Alt text saved.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  function remove() {
    if (!deleting || submitting.current || locked) return;
    submitting.current = true;
    deletion.mutate(
      {
        resource,
        id: deleting.id,
        mutationMode: 'pessimistic',
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: () => {
          setDeleting(null);
          setNotice('Image removed.');
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }
  const preview = rows.find((row) => row.id === previewId);
  const previewIndex = rows.findIndex((row) => row.id === previewId);
  function nextPreview(direction: number) {
    const next = rows[previewIndex + direction];
    if (next) setPreviewId(next.id);
  }
  return (
    <Stack component="section" aria-label="Event gallery" sx={{ gap: 3, minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Gallery
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {editable
              ? 'Up to 10 still JPEG, PNG or WebP images · 5 MiB and 20 megapixels each. Changes here are saved separately from the event.'
              : 'Images from this event.'}
          </Typography>
        </Box>
        <Button
          variant="soft"
          color="neutral"
          sx={{ flexShrink: 0 }}
          disabled={locked}
          onClick={() => {
            void gallery.query.refetch();
          }}
        >
          Refresh previews
        </Button>
      </Stack>
      {gallery.query.isError && <Alert severity="error">{gallery.query.error.message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {editable && (
        <Paper background={1} sx={{ p: 3, borderRadius: 6, outline: 0 }}>
          <Stack
            sx={{
              gap: 2,
              alignItems: 'center',
              p: 2,
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.elevation2',
            }}
          >
            <IconifyIcon
              icon="material-symbols:image-outline-rounded"
              sx={{ fontSize: 28, color: 'text.secondary' }}
            />
            <input
              ref={fileInput}
              type="file"
              aria-label="Choose gallery image"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={locked || Boolean(draft) || rows.length >= 10}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                if (file && !locked && !draft && rows.length < 10) void upload.upload(file);
              }}
            />
            <Button
              variant="soft"
              disabled={locked || Boolean(draft) || rows.length >= 10}
              onClick={() => {
                fileInput.current?.click();
              }}
            >
              Add image
            </Button>
            {gallery.query.isSuccess && (
              <Typography variant="caption" color="text.secondary">
                {rows.length} / 10 images
              </Typography>
            )}
          </Stack>
          {draft && (
            <Stack direction="row" sx={{ mt: 2, gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                disabled={locked}
                onClick={() => {
                  mutate({ action: 'reorder', ids: draft });
                }}
              >
                Save order
              </Button>
              <Button
                variant="soft"
                color="neutral"
                disabled={locked}
                onClick={() => {
                  void cancelOrder();
                }}
              >
                Cancel order
              </Button>
            </Stack>
          )}
        </Paper>
      )}
      {upload.state && (
        <Stack role="status" sx={{ gap: 1 }}>
          <Typography variant="body2">
            {upload.state.finishing ? 'Finishing' : 'Uploading'} {upload.state.name}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={upload.state.percent}
            aria-label="Image upload progress"
          />
          <Button
            disabled={upload.state.finishing}
            onClick={upload.cancel}
            sx={{ alignSelf: 'flex-start' }}
          >
            Cancel upload
          </Button>
        </Stack>
      )}
      {gallery.query.isPending ? (
        <Skeleton variant="rounded" height={180} />
      ) : gallery.query.isError ? (
        <Typography variant="body2" color="text.secondary">
          Gallery unavailable. Use Refresh previews to try again.
        </Typography>
      ) : !rows.length ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No images yet
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 225px), 1fr))',
            gap: 2,
          }}
        >
          {rows.map((row, index) => (
            <Paper
              key={row.id}
              component="article"
              aria-label={`Image ${row.originalName}`}
              background={1}
              sx={{ p: 2, borderRadius: 4, outline: 0, minWidth: 0 }}
              draggable={editable && !locked}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', row.id);
              }}
              onDragOver={(e) => {
                if (editable && !locked) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (editable) move(e.dataTransfer.getData('text/plain'), row.id);
              }}
            >
              <ButtonBase
                aria-label={`Preview ${row.originalName}`}
                onClick={() => {
                  setPreviewId(row.id);
                }}
                sx={{ width: '100%', borderRadius: 2, overflow: 'hidden' }}
              >
                <Box
                  component="img"
                  src={row.readUrl}
                  alt={row.altText ?? row.originalName}
                  draggable={false}
                  sx={{ width: '100%', height: 160, objectFit: 'cover' }}
                />
              </ButtonBase>
              <Stack direction="row" sx={{ gap: 1, my: 1, alignItems: 'center' }}>
                <Typography variant="subtitle2" noWrap title={row.originalName} sx={{ flex: 1 }}>
                  {row.originalName}
                </Typography>
                {row.isCover && <Chip size="small" color="primary" label="Cover" />}
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, overflowWrap: 'anywhere' }}
              >
                {row.altText ?? 'No alt text'}
              </Typography>
              {editable && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  <Button
                    size="small"
                    variant="soft"
                    disabled={locked || Boolean(draft) || row.isCover}
                    onClick={() => {
                      mutate({ action: 'cover', id: row.id });
                    }}
                  >
                    Set cover
                  </Button>
                  <Button
                    size="small"
                    color="neutral"
                    disabled={locked || Boolean(draft)}
                    onClick={() => {
                      update.mutation.reset();
                      setEditing(row);
                      setAltText(row.altText ?? '');
                    }}
                  >
                    Alt text
                  </Button>
                  <Button
                    size="small"
                    shape="square"
                    color="neutral"
                    aria-label={`Move ${row.originalName} earlier`}
                    disabled={locked || index === 0}
                    onClick={() => {
                      const previous = rows[index - 1];
                      if (previous) move(row.id, previous.id);
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    size="small"
                    shape="square"
                    color="neutral"
                    aria-label={`Move ${row.originalName} later`}
                    disabled={locked || index === rows.length - 1}
                    onClick={() => {
                      const next = rows[index + 1];
                      if (next) move(row.id, next.id);
                    }}
                  >
                    ↓
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    disabled={locked || Boolean(draft)}
                    onClick={() => {
                      deletion.mutation.reset();
                      setDeleting(row);
                    }}
                  >
                    Remove
                  </Button>
                </Stack>
              )}
            </Paper>
          ))}
        </Box>
      )}
      <Typography
        role="status"
        variant="body2"
        color="text.secondary"
        sx={{ '&:empty': { display: 'none' } }}
      >
        {notice}
      </Typography>
      <Dialog
        open={Boolean(preview)}
        onClose={() => {
          setPreviewId(null);
        }}
        aria-labelledby="gallery-preview-title"
        fullWidth
        maxWidth="lg"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            nextPreview(-1);
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextPreview(1);
          }
        }}
      >
        <DialogTitle id="gallery-preview-title" sx={{ overflowWrap: 'anywhere' }}>
          {preview?.originalName}
        </DialogTitle>
        <DialogContent>
          {preview && (
            <Box
              component="img"
              src={preview.readUrl}
              alt={preview.altText ?? preview.originalName}
              sx={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap' }}>
          <Button
            color="neutral"
            disabled={previewIndex <= 0}
            onClick={() => {
              nextPreview(-1);
            }}
          >
            Previous image
          </Button>
          <Button
            color="neutral"
            disabled={previewIndex >= rows.length - 1}
            onClick={() => {
              nextPreview(1);
            }}
          >
            Next image
          </Button>
          <Button
            onClick={() => {
              setPreviewId(null);
            }}
          >
            Close preview
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onClose={() => {
          if (!locked) setEditing(null);
        }}
        aria-labelledby="gallery-alt-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="gallery-alt-title">Image alt text</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Describe the image for people using assistive technology.
          </Typography>
          <TextField
            label="Alt text"
            value={altText}
            onChange={(e) => {
              setAltText(e.target.value);
            }}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            multiline
            minRows={3}
            fullWidth
            disabled={locked}
            autoFocus
            helperText={`${String(altText.length)} / 300`}
          />
          {update.mutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {update.mutation.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={locked}
            onClick={() => {
              setEditing(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={disabled}
            loading={update.mutation.isPending}
            onClick={saveAlt}
          >
            Save alt text
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onClose={() => {
          if (!locked) setDeleting(null);
        }}
        aria-labelledby="gallery-delete-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="gallery-delete-title">Remove image?</DialogTitle>
        <DialogContent>
          <Typography>
            {deleting?.originalName} will be removed from this gallery. This cannot be undone.
          </Typography>
          {deletion.mutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deletion.mutation.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            disabled={locked}
            onClick={() => {
              setDeleting(null);
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={disabled}
            loading={deletion.mutation.isPending}
            onClick={remove}
          >
            Remove image
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
