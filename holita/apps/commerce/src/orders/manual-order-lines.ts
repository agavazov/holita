import { isUUID } from 'class-validator';
import type { CartRepository } from '../cart/cart.repository.js';
import { CartPrice } from '../cart/cart.service.js';
import { checkoutError, invalidValue } from '../checkout/checkout.service.js';
import type { ManualOrderUpdateLineInput } from '../generated/graphql/types.js';
import type { OrderLine, Prisma } from '../generated/prisma/client.js';
import { catalogueOptionLabels } from '../products/product-relations.js';

export function manualOrderId(value: string, path: string): string {
  if (!isUUID(value)) {
    throw invalidValue(path);
  }
  return value.toLowerCase();
}

export function manualLineInputs(lines: ManualOrderUpdateLineInput[]) {
  if (!lines.length) {
    throw checkoutError('lines', 'REQUIRED', 'Add at least one order line');
  }
  return lines.map(({ lineId, variantId, quantity }, index) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw invalidValue(`lines.${String(index)}.quantity`);
    }
    if (lineId != null && variantId == null) {
      return { lineId: manualOrderId(lineId, `lines.${String(index)}.variantId`), quantity };
    }
    if (variantId != null && lineId == null) {
      return { variantId: manualOrderId(variantId, `lines.${String(index)}.variantId`), quantity };
    }
    throw invalidValue(`lines.${String(index)}.variantId`);
  });
}

type PublicVariant = Awaited<ReturnType<CartRepository['publicVariants']>>[number];

export function orderLineSnapshot(
  variant: PublicVariant,
  optionLabels = catalogueOptionLabels(variant.values),
) {
  return {
    variantId: variant.id,
    sku: variant.sku,
    label: [variant.product.name, ...optionLabels].join(' · '),
    unitPrice: variant.price,
  };
}

export function reviseOrderLines(
  inputs: ReturnType<typeof manualLineInputs>,
  previous: OrderLine[],
  sellable: PublicVariant[],
) {
  const oldLines = new Map(previous.map((line) => [line.id, line]));
  const sellableVariants = new Map(sellable.map((variant) => [variant.id, variant]));
  const seenLines = new Set<string>();
  const seenVariants = new Set<string>();
  const previousStock = new Map<string, Pick<OrderLine, 'quantity' | 'stockDeductedQuantity'>>();
  const stockDeltas = new Map<string, { quantity: number; path: string }>();
  let subtotal = new CartPrice(0);

  for (const { variantId, quantity, stockDeductedQuantity } of previous) {
    if (!variantId) {
      continue;
    }
    const prior = previousStock.get(variantId);
    const deducted = (prior?.stockDeductedQuantity ?? 0) + stockDeductedQuantity;
    previousStock.set(variantId, {
      quantity: (prior?.quantity ?? 0) + quantity,
      stockDeductedQuantity: deducted,
    });
    if (deducted) {
      stockDeltas.set(variantId, { quantity: -deducted, path: 'lines' });
    }
  }

  const lines = inputs.map(
    ({ lineId, variantId, quantity }, sortOrder): Prisma.OrderLineCreateManyOrderInput => {
      const path = `lines.${String(sortOrder)}.variantId`;
      const retained = lineId ? oldLines.get(lineId) : undefined;
      if (lineId && (!retained || seenLines.has(lineId))) {
        throw invalidValue(path);
      }
      const id = retained ? retained.variantId : variantId;
      const variant = id ? sellableVariants.get(id) : undefined;
      if ((!retained || quantity > retained.quantity) && !variant) {
        throw checkoutError(path, 'ORDER_VARIANT_UNAVAILABLE', 'Choose an available variant');
      }
      if (variant && quantity !== retained?.quantity && quantity < variant.minimumQuantity) {
        throw checkoutError(
          `lines.${String(sortOrder)}.quantity`,
          'MINIMUM_QUANTITY_NOT_MET',
          'Quantity is below the minimum for this variant',
        );
      }
      if (id && seenVariants.has(id)) {
        throw checkoutError(path, 'ORDER_VARIANT_DUPLICATE', 'Choose each variant only once');
      }
      if (lineId) {
        seenLines.add(lineId);
      }
      if (id) {
        seenVariants.add(id);
      }
      const snapshot = retained
        ? {
            id: retained.id,
            variantId: retained.variantId,
            label: retained.label,
            sku: retained.sku,
            unitPrice: retained.unitPrice,
          }
        : variant && orderLineSnapshot(variant);
      if (!snapshot) {
        throw checkoutError(path, 'ORDER_VARIANT_UNAVAILABLE', 'Choose an available variant');
      }
      // Track retained units by variant even when the line snapshot is replaced.
      const prior = id ? previousStock.get(id) : retained;
      const priorDeduction = prior?.stockDeductedQuantity ?? 0;
      const addedQuantity = Math.max(0, quantity - (prior?.quantity ?? 0));
      const stockDeductedQuantity =
        Math.min(quantity, priorDeduction) + (variant?.inventoryTracked ? addedQuantity : 0);
      if (id && stockDeductedQuantity) {
        stockDeltas.set(id, {
          quantity: stockDeductedQuantity - priorDeduction,
          path: `lines.${String(sortOrder)}.quantity`,
        });
      }
      subtotal = subtotal.plus(new CartPrice(snapshot.unitPrice).mul(quantity));
      return { ...snapshot, sortOrder, quantity, stockDeductedQuantity };
    },
  );

  return { lines, stockDeltas, subtotal };
}
