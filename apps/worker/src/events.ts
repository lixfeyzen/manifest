import { Prisma, type PrismaClient } from '@manifest/db';
import type { OrderEventType } from '@manifest/shared';

type Db = PrismaClient | Prisma.TransactionClient;

export interface WriteEventInput {
  orderId: string;
  type: OrderEventType;
  correlationId: string;
  payload?: Prisma.InputJsonValue;
}

/** Append one entry to an order's event timeline (every event carries a correlationId). */
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
