-- Replace the single-column status index with a composite (status, createdAt) that
-- serves the hot orders-list query (filter by status, order by createdAt). The
-- composite also covers status-only lookups as a left prefix; createdAt-only stays
-- for the unfiltered, time-ordered list.
DROP INDEX "Order_status_idx";
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- One line item per (order, sku) so the fulfillment reservation loop's
-- one-reservation-per-sku assumption is a database invariant. The unique index also
-- covers orderId lookups, so the previous single-column index is redundant.
DROP INDEX "OrderItem_orderId_idx";
CREATE UNIQUE INDEX "OrderItem_orderId_sku_key" ON "OrderItem"("orderId", "sku");
