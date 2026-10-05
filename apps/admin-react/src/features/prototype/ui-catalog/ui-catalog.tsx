import { useTranslation } from 'react-i18next';
import { Box, Chip, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useId } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../../components/page-header.js';
import { BodyExamples } from './body-examples.js';
import { ListExamples } from './list-examples.js';
import { FormExamples } from './form-examples.js';
import { StateExamples } from './state-examples.js';

const sections = [
  { key: 'body', label: 'prototype:catalog.tabs.body' },
  { key: 'lists', label: 'prototype:catalog.tabs.lists' },
  { key: 'forms', label: 'prototype:catalog.tabs.forms' },
  { key: 'states', label: 'prototype:catalog.tabs.states' },
] as const;
type Section = (typeof sections)[number]['key'];

export function UiCatalog() {
  const { t } = useTranslation(['prototype', 'common']);
  const id = useId();
  const [params, setParams] = useSearchParams();
  const section = sections.find((item) => item.key === params.get('tab'))?.key ?? 'body';
  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      <PageHeader
        title={t('prototype:catalog.title')}
        breadcrumbs={[
          { label: t('common:home'), to: '/' },
          { label: t('prototype:mode') },
          { label: t('prototype:catalog.title') },
        ]}
        action={<Chip label={t('prototype:catalog.interactive')} color="primary" variant="soft" />}
      />
      <Paper sx={{ px: { xs: 3, md: 5 }, pt: 3, pb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('prototype:catalog.description')}
        </Typography>
        <Tabs
          aria-label={t('prototype:catalog.tabs.label')}
          value={section}
          variant="scrollable"
          scrollButtons
          allowScrollButtonsMobile
          onChange={(_event, next: Section) => {
            setParams((current) => {
              const updated = new URLSearchParams(current);
              updated.set('tab', next);
              return updated;
            });
          }}
        >
          {sections.map((item) => (
            <Tab
              key={item.key}
              value={item.key}
              label={t(item.label)}
              id={`${id}-${item.key}`}
              aria-controls={`${id}-panel-${item.key}`}
            />
          ))}
        </Tabs>
      </Paper>
      <Box
        key={section}
        role="tabpanel"
        id={`${id}-panel-${section}`}
        aria-labelledby={`${id}-${section}`}
        sx={{ flex: 1, minWidth: 0 }}
      >
        {section === 'body' && <BodyExamples />}
        {section === 'lists' && <ListExamples />}
        {section === 'forms' && <FormExamples />}
        {section === 'states' && <StateExamples />}
      </Box>
    </Stack>
  );
}
