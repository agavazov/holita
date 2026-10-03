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
  const [state, setState] = useState<State>('ready');
  const [refreshWarning, setRefreshWarning] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Stack sx={{ gap: 5 }}>
        <ContentSection
          title="Content states"
          description="Initial loading, no records, failed reads and disabled content must remain distinguishable."
        >
          <StyledTextField
            select
            label="Content state"
            value={state}
            sx={{ width: { xs: '100%', sm: 260 } }}
            onChange={(event) => {
              const next = states.find((value) => value === event.target.value);
              if (next) setState(next);
            }}
          >
            <MenuItem value="ready">Ready</MenuItem>
            <MenuItem value="loading">Loading</MenuItem>
            <MenuItem value="empty">Empty</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </StyledTextField>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, minHeight: 168 }}>
            {state === 'ready' && (
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">Example content is available</Typography>
                <Typography variant="body2" color="text.secondary">
                  Successful data loads show the content and its applicable actions.
                </Typography>
                <Button
                  variant="soft"
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    setNotice('Content action activated.');
                  }}
                >
                  Example action
                </Button>
              </Stack>
            )}
            {state === 'loading' && (
              <Stack aria-busy="true" sx={{ gap: 2 }}>
                <Typography role="status">Loading example…</Typography>
                <Skeleton width="60%" />
                <Skeleton variant="rounded" height={64} />
              </Stack>
            )}
            {state === 'empty' && (
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">No examples yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Explain the empty result and offer the next useful action.
                </Typography>
                <Button
                  variant="contained"
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    setState('ready');
                  }}
                >
                  Create example
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
                    Retry
                  </Button>
                }
              >
                <AlertTitle>Could not load examples</AlertTitle>This is a simulated read failure.
                Retry returns to the ready preview.
              </Alert>
            )}
            {state === 'disabled' && (
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">Example is unavailable</Typography>
                <Typography variant="body2" color="text.secondary">
                  Explain why the action is unavailable.
                </Typography>
                <Button variant="contained" disabled sx={{ alignSelf: 'flex-start' }}>
                  Unavailable action
                </Button>
              </Stack>
            )}
          </Paper>
        </ContentSection>
        <ContentSection
          title="Background refresh"
          description="Keep existing content and drafts when a refresh fails. Use the shared warning to offer Retry."
        >
          {refreshWarning ? (
            <QueryRefreshWarning
              message="Example connection interrupted."
              refreshing={false}
              onRetry={() => {
                setRefreshWarning(false);
              }}
            />
          ) : (
            <Alert severity="success">Example refresh completed. Existing content was kept.</Alert>
          )}
          <Button
            variant="soft"
            color="neutral"
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setRefreshWarning(true);
            }}
          >
            Simulate refresh failure
          </Button>
        </ContentSection>
        <ContentSection
          title="Alerts & progress"
          description="Use severity and readable text together. Pending controls prevent duplicate submission."
        >
          <Alert severity="info">Informational message with context.</Alert>
          <Alert severity="success">Changes saved successfully.</Alert>
          <Alert severity="warning">Review this detail before continuing.</Alert>
          <Alert severity="error">The action failed. Entered values are preserved.</Alert>
          <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
            <CircularProgress size={24} aria-label="Pending progress example" />
            <Typography variant="body2">Indeterminate progress</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={60} aria-label="Progress example" />
          <Typography variant="caption" color="text.secondary">
            Determinate progress · 60%
          </Typography>
        </ContentSection>
        <ContentSection
          title="Confirmation & notifications"
          description="Confirm destructive actions, offer Cancel and show the outcome after completion."
        >
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="soft"
              color="error"
              onClick={() => {
                setConfirming(true);
              }}
            >
              Open confirmation
            </Button>
            <Button
              variant="soft"
              onClick={() => {
                setNotice('Example notification shown.');
              }}
            >
              Show notification
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
        <DialogTitle id="catalog-confirm-title">Delete this example?</DialogTitle>
        <DialogContent>
          <Typography>
            This previews a confirmation dialog. No stored record will be deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            onClick={() => {
              setConfirming(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirming(false);
              setNotice('Example action confirmed. No records were changed.');
            }}
          >
            Confirm example
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
