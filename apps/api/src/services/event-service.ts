import { Prisma, type PrismaClient } from '@manifest/db';
import type { OrderEventType } from '@manifest/shared';

/**
 * A Prisma client OR an interactive transaction client. Writing events through
 * this union lets us record an event as part of the same transaction as the data
 * change it describes — so the timeline can never disagree with the data.
 */
type Db = PrismaClient | Prisma.TransactionClient;

export interface WriteEventInput {
  orderId: string;
  type: OrderEventType;
  correlationId: string;
  payload?: Prisma.InputJsonValue;
}

/**
 * Append one entry to an order's event timeline. Every event carries a
 * correlationId (business rule #11) so a whole flow can be traced end to end.
 */
export async function writeEvent(db: Db, input: WriteEventInput): Promise<void> {
  await db.orderEvent.create({
    data: {
      orderId: input.orderId,
      type: input.type,
      correlationId: input.correlationId,
      payload: input.payload ?? {},
    },
  });
}
