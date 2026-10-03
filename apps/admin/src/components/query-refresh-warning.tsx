import { Alert, AlertTitle, Button } from '@mui/material';
import { useLocalization } from '../localization/localization-provider.js';

export function QueryRefreshWarning({
  message,
  refreshing,
  onRetry,
}: {
  message: string;
  refreshing: boolean;
  onRetry: () => void;
}) {
  const { t } = useLocalization();

  return (
    <Alert
      severity="warning"
      sx={{ m: 3 }}
      action={
        <Button loading={refreshing} onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    >
      <AlertTitle>{t('common.refreshError')}</AlertTitle>
      {message} {t('common.workPreserved')}
    </Alert>
  );
}
