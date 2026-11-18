import { startOperator } from '@holita/operator';

void startOperator('backoffice').catch((error: unknown) => {
  console.error(error);
});
