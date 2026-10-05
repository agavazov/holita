import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { ContentSection } from '../../../components/content-section.js';
import { QueryRefreshWarning } from '../../../components/query-refresh-warning.js';
import StyledTextField from '../../../layout/primitives/styled-text-field.js';

const states = ['ready', 'loading', 'empty', 'error', 'disabled'] as const;
type State = (typeof states)[number];

export function StateExamples() {
  const { t } = useTranslation(['prototype', 'common']);
  const [state, setState] = useState<State>('ready');
  const [refreshWarning, setRefreshWarning] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Stack sx={{ gap: 5 }}>
        <ContentSection
          title={t('prototype:catalog.feedback.title')}
          description={t('prototype:catalog.feedback.description')}
        >
          <StyledTextField
            select
            label={t('prototype:catalog.feedback.state')}
            value={state}
            sx={{ width: { xs: '100%', sm: 260 } }}
            onChange={(event) => {
              const next = states.find((value) => value === event.target.value);
              if (next) setState(next);
            }}
          >
            <MenuItem value="ready">{t('prototype:catalog.states.ready')}</MenuItem>
            <MenuItem value="loading">{t('prototype:catalog.states.loading')}</MenuItem>
            <MenuItem value="empty">{t('prototype:catalog.states.empty')}</MenuItem>
            <MenuItem value="error">{t('prototype:catalog.states.error')}</MenuItem>
            <MenuItem value="disabled">{t('prototype:catalog.states.disabled')}</MenuItem>
          </StyledTextField>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, minHeight: 168 }}>
            {state === 'ready' && (
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">
                  {t('prototype:catalog.feedback.available')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('prototype:catalog.feedback.availableHint')}
                </Typography>
                <Button
                  variant="soft"
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    setNotice(t('prototype:catalog.feedback.actionNotice'));
                  }}
                >
                  {t('prototype:catalog.feedback.action')}
                </Button>
              </Stack>
            )}
            {state === 'loading' && (
              <Stack aria-busy="true" sx={{ gap: 2 }}>
                <Typography role="status">{t('prototype:catalog.feedback.loading')}</Typography>
                <Skeleton width="60%" />
                <Skeleton variant="rounded" height={64} />
              </Stack>
            )}
            {state === 'empty' && (
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">{t('prototype:catalog.feedback.empty')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('prototype:catalog.feedback.emptyHint')}
                </Typography>
                <Button
                  variant="contained"
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    setState('ready');
                  }}
                >
                  {t('prototype:catalog.feedback.create')}
                </Button>
              </Stack>
            )}
            {state === 'error' && (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    onClick={() => {
                      setState('ready');
                    }}
                  >
                    {t('common:actions.retry')}
                  </Button>
                }
              >
                <AlertTitle>{t('prototype:catalog.feedback.loadError')}</AlertTitle>
                {t('prototype:catalog.feedback.loadErrorHint')}
              </Alert>
            )}
            {state === 'disabled' && (
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">
                  {t('prototype:catalog.feedback.unavailable')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('prototype:catalog.feedback.unavailableHint')}
                </Typography>
                <Button variant="contained" disabled sx={{ alignSelf: 'flex-start' }}>
                  {t('prototype:catalog.feedback.unavailableAction')}
                </Button>
              </Stack>
            )}
          </Paper>
        </ContentSection>
        <ContentSection
          title={t('prototype:catalog.feedback.refresh')}
          description={t('prototype:catalog.feedback.refreshHint')}
        >
          {refreshWarning ? (
            <QueryRefreshWarning
              message={t('prototype:catalog.feedback.connection')}
              refreshing={false}
              onRetry={() => {
                setRefreshWarning(false);
              }}
            />
          ) : (
            <Alert severity="success">{t('prototype:catalog.feedback.refreshed')}</Alert>
          )}
          <Button
            variant="soft"
            color="neutral"
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setRefreshWarning(true);
            }}
          >
            {t('prototype:catalog.feedback.simulateRefresh')}
          </Button>
        </ContentSection>
        <ContentSection
          title={t('prototype:catalog.feedback.alerts')}
          description={t('prototype:catalog.feedback.alertsHint')}
        >
          <Alert severity="info">{t('prototype:catalog.feedback.info')}</Alert>
          <Alert severity="success">{t('prototype:catalog.feedback.success')}</Alert>
          <Alert severity="warning">{t('prototype:catalog.feedback.warning')}</Alert>
          <Alert severity="error">{t('prototype:catalog.feedback.error')}</Alert>
          <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
            <CircularProgress
              size={24}
              aria-label={t('prototype:catalog.feedback.pendingProgress')}
            />
            <Typography variant="body2">{t('prototype:catalog.feedback.indeterminate')}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={60}
            aria-label={t('prototype:catalog.feedback.progress')}
          />
          <Typography variant="caption" color="text.secondary">
            {t('prototype:catalog.feedback.determinate')}
          </Typography>
        </ContentSection>
        <ContentSection
          title={t('prototype:catalog.feedback.confirmation')}
          description={t('prototype:catalog.feedback.confirmationHint')}
        >
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="soft"
              color="error"
              onClick={() => {
                setConfirming(true);
              }}
            >
              {t('prototype:catalog.feedback.openConfirmation')}
            </Button>
            <Button
              variant="soft"
              onClick={() => {
                setNotice(t('prototype:catalog.feedback.notice'));
              }}
            >
              {t('prototype:catalog.feedback.showNotice')}
            </Button>
          </Stack>
        </ContentSection>
      </Stack>
      <Dialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        aria-labelledby="catalog-confirm-title"
      >
        <DialogTitle id="catalog-confirm-title">
          {t('prototype:catalog.feedback.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>{t('prototype:catalog.feedback.confirmationDescription')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            onClick={() => {
              setConfirming(false);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirming(false);
              setNotice(t('prototype:catalog.feedback.confirmed'));
            }}
          >
            {t('prototype:catalog.feedback.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
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
