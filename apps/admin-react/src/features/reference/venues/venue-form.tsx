import { useTranslation } from 'react-i18next';
// Aurora CreateEvent composition with Venue fields and validation.
import {
  Alert,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ContentSection } from '../../../components/content-section.js';
import { EditorAside } from '../../../components/editor-aside.js';
import type { DataError } from '../../../data/data-provider.js';
import type { CreateReferenceVenueInput } from '../../../generated/graphql/operations.js';
import { textError } from '../text-validation.js';

type VenueFormProps = {
  header?: ReactNode;
  initialValues?: CreateReferenceVenueInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceVenueInput) => void;
  onCancel: () => void;
  onChange: () => void;
};

export function VenueForm({
  header,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: VenueFormProps) {
  const { t } = useTranslation(['validation', 'reference', 'common']);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    city: initialValues?.city ?? '',
    countryCode: initialValues?.countryCode ?? 'BG',
    address: initialValues?.address ?? '',
    capacity: initialValues?.capacity?.toString() ?? '',
    active: initialValues?.active ?? true,
  });
  const [attempted, setAttempted] = useState(false);
  const errors = {
    name: textError(values.name, 200, t('reference.venueName'), t),
    description: textError(values.description, 2000, '', t),
    city: textError(values.city, 120, t('reference.city'), t),
    countryCode: /^[a-z]{2}$/i.test(values.countryCode.trim()) ? '' : t('reference.countryCode'),
    address: textError(values.address, 300, '', t),
    capacity:
      values.capacity !== '' &&
      (!Number.isInteger(Number(values.capacity)) ||
        Number(values.capacity) < 1 ||
        Number(values.capacity) > 2147483647)
        ? t('reference.positiveInteger')
        : '',
    active: '',
  };
  function message(field: keyof typeof values) {
    return (
      (attempted && errors[field]) ||
      error?.fieldErrors.find(({ path }) => path === field)?.message ||
      ''
    );
  }
  function change<Field extends keyof typeof values>(field: Field, value: (typeof values)[Field]) {
    setValues({ ...values, [field]: value });
    onChange();
  }
  useEffect(() => {
    const first = error?.fieldErrors.find(({ path }) => form.current?.elements.namedItem(path));
    const input = first && form.current?.elements.namedItem(first.path);
    if (input instanceof HTMLElement) input.focus();
  }, [error]);

  return (
    <Stack
      component="form"
      ref={form}
      noValidate
      direction={{ xs: 'column', md: 'row' }}
      sx={{ flex: 1, minWidth: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setAttempted(true);
        const first = Object.entries(errors).find(([, value]) => value);
        if (first) {
          const input = form.current?.elements.namedItem(first[0]);
          if (input instanceof HTMLElement) input.focus();
          return;
        }
        onSubmit({
          name: values.name.trim(),
          description: values.description.trim() || null,
          city: values.city.trim(),
          countryCode: values.countryCode.trim().toUpperCase(),
          address: values.address.trim() || null,
          capacity: values.capacity === '' ? null : Number(values.capacity),
          active: values.active,
        });
      }}
    >
      <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, minWidth: 0 }}>
        {header}
        <Stack sx={{ gap: 4, maxWidth: 520, mx: 'auto' }}>
          {error && (
            <Alert severity="error">
              {error.message}
              {error.requestId && (
                <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {t('common:requestId', { id: error.requestId })}
                </Typography>
              )}
            </Alert>
          )}
          <ContentSection
            title={t('reference:venues.form.details')}
            description={t('reference:venues.form.description')}
          >
            <TextField
              id={`${id}-name`}
              name="name"
              label={t('reference:fields.name')}
              autoFocus
              autoComplete="off"
              fullWidth
              disabled={pending}
              value={values.name}
              onChange={(event) => {
                change('name', event.target.value);
              }}
              error={Boolean(message('name'))}
              helperText={message('name') || t('reference:lookups.nameHint')}
            />
            <TextField
              id={`${id}-description`}
              name="description"
              label={t('reference:fields.description')}
              multiline
              rows={4}
              fullWidth
              disabled={pending}
              value={values.description}
              onChange={(event) => {
                change('description', event.target.value);
              }}
              error={Boolean(message('description'))}
              helperText={message('description') || t('reference:lookups.descriptionHint')}
            />
          </ContentSection>
          <ContentSection
            title={t('reference:venues.form.location')}
            description={t('reference:venues.form.locationHint')}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
              <TextField
                id={`${id}-city`}
                name="city"
                label={t('reference:fields.city')}
                autoComplete="address-level2"
                fullWidth
                disabled={pending}
                value={values.city}
                onChange={(event) => {
                  change('city', event.target.value);
                }}
                error={Boolean(message('city'))}
                helperText={message('city')}
              />
              <TextField
                id={`${id}-countryCode`}
                name="countryCode"
                label={t('reference:fields.countryCode')}
                autoComplete="country"
                fullWidth
                disabled={pending}
                value={values.countryCode}
                onChange={(event) => {
                  change('countryCode', event.target.value);
                }}
                error={Boolean(message('countryCode'))}
                helperText={message('countryCode') || t('reference:venues.form.countryHint')}
                sx={{ maxWidth: { sm: 180 } }}
              />
            </Stack>
            <TextField
              id={`${id}-address`}
              name="address"
              label={t('reference:fields.address')}
              autoComplete="street-address"
              fullWidth
              disabled={pending}
              value={values.address}
              onChange={(event) => {
                change('address', event.target.value);
              }}
              error={Boolean(message('address'))}
              helperText={message('address') || t('reference:venues.form.addressHint')}
            />
          </ContentSection>
        </Stack>
      </Paper>
      <EditorAside
        label={t('reference:venues.form.settings')}
        actions={
          <>
            <Button variant="soft" color="neutral" onClick={onCancel} disabled={pending}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="contained"
              type="submit"
              aria-label={t('reference:venues.actions.save')}
              aria-busy={pending}
              loading={pending}
              sx={{ flexGrow: 1 }}
            >
              {t('reference:venues.actions.save')}
            </Button>
          </>
        }
      >
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {t('common:status.label')}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                name="active"
                checked={values.active}
                disabled={pending}
                onChange={(_, checked) => {
                  change('active', checked);
                }}
                slotProps={{ input: { role: 'switch' } }}
              />
            }
            label={t('common:status.active')}
          />
          {message('active') && (
            <Typography variant="caption" color="error">
              {message('active')}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {values.active
              ? t('reference:venues.form.activeHint')
              : t('reference:venues.form.inactiveHint')}
          </Typography>
          <TextField
            id={`${id}-capacity`}
            name="capacity"
            label={t('reference:fields.capacity')}
            type="number"
            fullWidth
            disabled={pending}
            value={values.capacity}
            onChange={(event) => {
              change('capacity', event.target.value);
            }}
            error={Boolean(message('capacity'))}
            helperText={message('capacity') || t('reference:lookups.capacityHint')}
            slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
          />
        </Stack>
        <Stack sx={{ p: { xs: 3, lg: 5 }, gap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t('common:summary')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {values.name.trim() || t('reference:venues.form.untitled')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {values.city.trim() || t('reference:venues.form.cityNotSet')} ·{' '}
            {values.countryCode.trim().toUpperCase() || t('reference:venues.form.countryNotSet')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialValues
              ? t('reference:venues.form.editHint')
              : t('reference:venues.form.createHint')}
          </Typography>
        </Stack>
      </EditorAside>
    </Stack>
  );
}
