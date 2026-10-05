import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
  return (
    <Alert
      severity="warning"
      sx={{ m: 3 }}
      action={
        <Button loading={refreshing} onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      }
    >
      <AlertTitle>{t('refresh.title')}</AlertTitle>
      {message} {t('refresh.preserved')}
    </Alert>
  );
}
