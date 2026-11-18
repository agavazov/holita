import { startOperator } from '@holita/operator';

void startOperator('sales').catch((error: unknown) => {
  console.error(error);
});
