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
  trackedIds: Set<string>,
) {
  const oldLines = new Map(previous.map((line) => [line.id, line]));
  const sellableVariants = new Map(sellable.map((variant) => [variant.id, variant]));
  const seenLines = new Set<string>();
  const seenVariants = new Set<string>();
  const stockDeltas = new Map<string, { quantity: number; path: string }>();
  let subtotal = new CartPrice(0);

  for (const { variantId, stockDecremented, quantity } of previous) {
    if (variantId && stockDecremented) {
      stockDeltas.set(variantId, {
        quantity: (stockDeltas.get(variantId)?.quantity ?? 0) - quantity,
        path: 'lines',
      });
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
      const stockDecremented =
        retained?.quantity === quantity ? retained.stockDecremented : !!id && trackedIds.has(id);
      if (id && stockDecremented) {
        stockDeltas.set(id, {
          quantity: (stockDeltas.get(id)?.quantity ?? 0) + quantity,
          path: `lines.${String(sortOrder)}.quantity`,
        });
      }
      subtotal = subtotal.plus(new CartPrice(snapshot.unitPrice).mul(quantity));
      return { ...snapshot, sortOrder, quantity, stockDecremented };
    },
  );

  return { lines, stockDeltas, subtotal };
}
