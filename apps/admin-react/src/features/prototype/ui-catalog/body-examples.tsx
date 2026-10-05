import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { ContentSection } from '../../../components/content-section.js';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';

export function BodyExamples() {
  const { t } = useTranslation(['prototype', 'common', 'reference', 'stores']);
  const [notice, setNotice] = useState('');
  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Stack divider={<Divider />} sx={{ gap: 5 }}>
        <ContentSection
          title={t('prototype:catalog.body.typography')}
          description={t('prototype:catalog.body.typographyHint')}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 4 }}>
            <Stack sx={{ gap: 2 }}>
              {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((variant) => (
                <Box key={variant}>
                  <Typography variant="caption" color="text.secondary">
                    {variant.toUpperCase()}
                  </Typography>
                  <Typography variant={variant} component="p">
                    {t('prototype:catalog.body.heading')}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Stack sx={{ gap: 3 }}>
              <Typography variant="subtitle1">{t('prototype:catalog.body.subtitle')}</Typography>
              <Typography variant="body1">{t('prototype:catalog.body.bodyText')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('prototype:catalog.body.secondary')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('prototype:catalog.body.caption')}
              </Typography>
              <Typography variant="overline">{t('prototype:catalog.body.sectionLabel')}</Typography>
              <Typography
                component="blockquote"
                variant="body1"
                sx={{ m: 0, pl: 3, borderLeft: 3, borderColor: 'primary.main' }}
              >
                {t('prototype:catalog.body.quote')}
              </Typography>
              <Link
                component="button"
                underline="hover"
                onClick={() => {
                  setNotice(t('prototype:catalog.body.linkNotice'));
                }}
              >
                {t('prototype:catalog.body.link')}
              </Link>
            </Stack>
          </Box>
        </ContentSection>
        <ContentSection
          title={t('prototype:catalog.body.cards')}
          description={t('prototype:catalog.body.cardsHint')}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Paper variant="outlined" background={1} sx={{ p: 3, borderRadius: 2 }}>
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">{t('prototype:catalog.body.summary')}</Typography>
                <Chip
                  label={t('common:status.active')}
                  color="success"
                  variant="soft"
                  sx={{ alignSelf: 'flex-start' }}
                />
                <Typography variant="body2" color="text.secondary">
                  {t('prototype:catalog.body.cardHint')}
                </Typography>
                <Box
                  component="dl"
                  sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1.5 }}
                >
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {t('stores:label')}
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                    holita Sofia
                  </Typography>
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {t('prototype:catalog.body.visibility')}
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                    {t('reference:events.status.PUBLISHED')}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <List disablePadding aria-label={t('prototype:catalog.body.activity')}>
                {[
                  t('prototype:catalog.body.created'),
                  t('prototype:catalog.body.updated'),
                  t('prototype:catalog.body.review'),
                ].map((label, index) => (
                  <ListItem key={label} disableGutters>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}>
                        {index + 1}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={label}
                      secondary={t('prototype:catalog.body.localActivity')}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        </ContentSection>
        <ContentSection
          title={t('prototype:catalog.body.buttons')}
          description={t('prototype:catalog.body.buttonsHint')}
        >
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={() => {
                setNotice(t('prototype:catalog.body.primaryNotice'));
              }}
            >
              {t('prototype:catalog.body.primary')}
            </Button>
            <Button
              variant="soft"
              color="neutral"
              onClick={() => {
                setNotice(t('prototype:catalog.body.secondaryNotice'));
              }}
            >
              {t('prototype:catalog.body.secondaryAction')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setNotice(t('prototype:catalog.body.outlinedNotice'));
              }}
            >
              {t('prototype:catalog.body.outlined')}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setNotice(t('prototype:catalog.body.textNotice'));
              }}
            >
              {t('prototype:catalog.body.textAction')}
            </Button>
            <Button
              variant="soft"
              color="error"
              onClick={() => {
                setNotice(t('prototype:catalog.body.destructiveNotice'));
              }}
            >
              {t('prototype:catalog.body.destructive')}
            </Button>
            <Button variant="contained" disabled>
              {t('prototype:catalog.states.disabled')}
            </Button>
            <Button
              variant="contained"
              loading
              aria-label={t('prototype:catalog.body.pendingAction')}
            >
              {t('prototype:catalog.body.pending')}
            </Button>
            <Tooltip title={t('prototype:catalog.body.settings')}>
              <Button
                shape="circle"
                color="neutral"
                variant="soft"
                aria-label={t('prototype:catalog.body.settings')}
                onClick={() => {
                  setNotice(t('prototype:catalog.body.settingsNotice'));
                }}
              >
                <IconifyIcon icon="material-symbols:settings-outline-rounded" />
              </Button>
            </Tooltip>
          </Stack>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Chip label={t('common:status.active')} color="success" variant="soft" />
            <Chip label={t('reference:events.status.DRAFT')} color="neutral" variant="soft" />
            <Chip label={t('prototype:catalog.body.attention')} color="warning" variant="soft" />
            <Chip label={t('prototype:catalog.body.unavailable')} color="error" variant="soft" />
            <Chip label={t('prototype:catalog.body.information')} color="info" variant="soft" />
            <Chip label={t('prototype:catalog.body.outlinedBadge')} variant="outlined" />
          </Stack>
        </ContentSection>
        <ContentSection
          title={t('prototype:catalog.body.table')}
          description={t('prototype:catalog.body.tableHint')}
        >
          <TableContainer>
            <Table size="small" aria-label={t('prototype:catalog.body.summary')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('prototype:catalog.body.metric')}</TableCell>
                  <TableCell align="right">{t('prototype:catalog.body.value')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { label: t('prototype:catalog.body.total'), value: 12 },
                  { label: t('prototype:catalog.body.active'), value: 8 },
                  { label: t('prototype:catalog.body.drafts'), value: 4 },
                ].map((row) => (
                  <TableRow key={row.label}>
                    <TableCell component="th" scope="row">
                      {row.label}
                    </TableCell>
                    <TableCell align="right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ContentSection>
        <ContentSection
          title={t('prototype:catalog.body.expandable')}
          description={t('prototype:catalog.body.expandableHint')}
        >
          <Box>
            <Accordion>
              <AccordionSummary aria-controls="catalog-detail-content" id="catalog-detail-heading">
                <Typography>{t('prototype:catalog.body.moreDetails')}</Typography>
              </AccordionSummary>
              <AccordionDetails id="catalog-detail-content">
                <Typography variant="body2">{t('prototype:catalog.body.detailsHint')}</Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion disabled>
              <AccordionSummary>
                <Typography>{t('prototype:catalog.body.unavailableDetails')}</Typography>
              </AccordionSummary>
            </Accordion>
          </Box>
        </ContentSection>
      </Stack>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4000}
        onClose={() => {
          setNotice('');
        }}
      >
        <Alert
          severity="success"
          onClose={() => {
            setNotice('');
          }}
        >
          {notice}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
