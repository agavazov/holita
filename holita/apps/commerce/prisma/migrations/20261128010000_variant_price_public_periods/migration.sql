-- Existing observations did not record whether their prices were public.
ALTER TABLE "productVariantPriceHistory"
  ADD COLUMN "publicFrom" TIMESTAMPTZ(3),
  ADD COLUMN "publicUntil" TIMESTAMPTZ(3);

