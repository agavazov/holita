export function coversWholeOrder(
  orderLines: readonly { id: string; quantity: number }[],
  returnLines: readonly { orderLineId: string; quantity: number }[],
) {
  if (!returnLines.length || returnLines.length !== orderLines.length) {
    return false;
  }
  const quantities = new Map(orderLines.map(({ id, quantity }) => [id, quantity]));
  return returnLines.every(({ orderLineId, quantity }) => quantities.get(orderLineId) === quantity);
}
