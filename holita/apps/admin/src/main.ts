import { startOperator } from '@holita/operator';

void startOperator('admin').catch((error: unknown) => {
  console.error(error);
});
