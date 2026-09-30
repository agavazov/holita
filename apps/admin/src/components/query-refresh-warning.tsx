import { Alert, AlertTitle, Button } from '@mui/material';

export function QueryRefreshWarning({
  message,
  refreshing,
  onRetry,
}: {
  message: string;
  refreshing: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert
      severity="warning"
      sx={{ m: 3 }}
      action={
        <Button loading={refreshing} onClick={onRetry}>
          Retry
        </Button>
      }
    >
      <AlertTitle>Could not refresh data</AlertTitle>
      {message} Your current work is preserved.
    </Alert>
  );
}
