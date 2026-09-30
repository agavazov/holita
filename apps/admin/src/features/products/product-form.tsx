// Aurora CreateEvent / EventAside composition, bound to the existing Product inputs.
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useId, useRef, useState, type ReactNode } from 'react';
import { EditorAside } from '../../components/editor-aside.js';
import type { DataError } from '../../data/data-provider.js';
import type { CreateProductInput } from '../../generated/graphql/operations.js';

type ProductFormProps = {
  header?: ReactNode;
  initialValues?: CreateProductInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateProductInput) => void;
  onCancel: () => void;
};

function fieldError(value: string, label: string, max: number) {
  if (!value.trim()) return label === 'Name' ? 'Enter a product name.' : 'Enter a SKU.';
  if (value.includes('\u0000')) return 'Remove unsupported characters.';
  if (Array.from(value.trim()).length > max) return `Use at most ${String(max)} characters.`;
  return '';
}

export function ProductForm({
  header,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const id = useId();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [sku, setSku] = useState(initialValues?.sku ?? '');
  const [status, setStatus] = useState(initialValues?.status ?? 'DRAFT');
  const [attempted, setAttempted] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const skuInput = useRef<HTMLInputElement>(null);
  const nameError = fieldError(name, 'Name', 200);
  const skuError = fieldError(sku, 'SKU', 100);
  return (
    <Stack
      component="form"
      noValidate
      direction={{ xs: 'column', md: 'row' }}
      sx={{ flex: 1, minWidth: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setAttempted(true);
        if (nameError || skuError) {
          (nameError ? nameInput : skuInput).current?.focus();
          return;
        }
        onSubmit({ name: name.trim(), sku: sku.trim(), status });
      }}
    >
      <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
        {header}
        <Stack sx={{ gap: 3, maxWidth: 520, mx: 'auto' }}>
          <Box>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              Product details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Give your product a name and a unique SKU.
            </Typography>
          </Box>
          {error && (
            <Alert severity="error">
              {error.message}
              {error.requestId && (
                <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  Request ID: {error.requestId}
                </Typography>
              )}
            </Alert>
          )}
          <TextField
            id={`${id}-name`}
            label="Name"
            autoFocus
            autoComplete="off"
            fullWidth
            disabled={pending}
            inputRef={nameInput}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            error={attempted && Boolean(nameError)}
            helperText={
              attempted && nameError
                ? nameError
                : 'Use the name you want to see in the product list.'
            }
          />
          <TextField
            id={`${id}-sku`}
            label="SKU"
            autoComplete="off"
            fullWidth
            disabled={pending}
            inputRef={skuInput}
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
            }}
            error={attempted && Boolean(skuError)}
            helperText={
              attempted && skuError ? skuError : 'Case-sensitive. Must be unique within this store.'
            }
          />
        </Stack>
      </Paper>
      <EditorAside
        label="Product settings"
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label="Save product"
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              Save product
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 3 }}>
          <Typography variant="h6" component="h2">
            Status
          </Typography>
          <TextField
            id={`${id}-status`}
            label="Status"
            select
            fullWidth
            value={status}
            disabled={pending}
            onChange={(event) => {
              if (event.target.value === 'ACTIVE' || event.target.value === 'DRAFT')
                setStatus(event.target.value);
            }}
          >
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {status === 'ACTIVE'
              ? 'The product will be marked as active.'
              : 'The product will be saved as a draft.'}
          </Typography>
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Summary
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {name.trim() || 'Untitled product'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            SKU: {sku.trim() || 'Not set'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? 'Save changes to this product in the selected store.'
              : 'Create a new product in the selected store.'}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
