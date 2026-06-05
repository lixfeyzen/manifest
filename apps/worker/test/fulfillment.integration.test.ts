import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@manifest/db';
import { runFulfillment } from '../src/fulfillment-processor.js';
import { createPaidOrder, resetAndSeed } from './helpers.js';

describe('fulfillment processor (worker integration)', () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('fulfills a paid order: stock down once, one invoice, one reservation', async () => {
    const order = await createPaidOrder('SKU-STICKER', 3);

    await runFulfillment({ orderId: order.id, correlationId: 'corr_1' });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('FULFILLED');

    const stock = await prisma.inventoryItem.findUnique({ where: { sku: 'SKU-STICKER' } });
    expect(stock!.stock).toBe(97); // 100 - 3

    expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('is a safe no-op when re-run on an already-fulfilled order', async () => {
    const order = await createPaidOrder('SKU-STICKER', 3);

    await runFulfillment({ orderId: order.id, correlationId: 'corr_1' });
    // Second run simulates a BullMQ retry / manual retry of a finished order.
    await runFulfillment({ orderId: order.id, correlationId: 'corr_2' });

    const stock = await prisma.inventoryItem.findUnique({ where: { sku: 'SKU-STICKER' } });
    expect(stock!.stock).toBe(97); // still deducted only once
    expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('does not double-reserve when resuming an interrupted (FULFILLING) order', async () => {
    const order = await createPaidOrder('SKU-COFFEE', 4);

    // Simulate a previous attempt that reserved stock then crashed before
    // finishing: decrement stock, create the reservation, leave status FULFILLING.
    await prisma.inventoryItem.update({ where: { sku: 'SKU-COFFEE' }, data: { stock: 16 } });
    await prisma.inventoryReservation.create({
      data: { orderId: order.id, sku: 'SKU-COFFEE', quantity: 4 },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FULFILLING' } });

    await runFulfillment({ orderId: order.id, correlationId: 'corr_resume' });

    const stock = await prisma.inventoryItem.findUnique({ where: { sku: 'SKU-COFFEE' } });
    expect(stock!.stock).toBe(16); // NOT 12 — the existing reservation was respected
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('FULFILLED');
  });

  it('fails permanently and rolls back stock when stock is insufficient', async () => {
    const order = await createPaidOrder('SKU-HOODIE', 6); // only 5 in stock

    await expect(
      runFulfillment({ orderId: order.id, correlationId: 'corr_fail' }),
    ).rejects.toThrow(/Insufficient stock/);

    const stock = await prisma.inventoryItem.findUnique({ where: { sku: 'SKU-HOODIE' } });
    expect(stock!.stock).toBe(5); // unchanged — transaction rolled back
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(0);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('FAILED');
  });
});
