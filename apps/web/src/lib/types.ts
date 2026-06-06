// View types mirroring the API's GraphQL schema. The web app keeps its own copy
// so the frontend stays decoupled from server-only code (Zod schemas, Prisma).

export type OrderStatus = 'PENDING' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'FAILED';
export type FulfillmentJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Payment {
  id: string;
  amount: number;
  status: 'SUCCEEDED' | 'FAILED';
  providerEventId: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: 'ISSUED';
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  type: string;
  payload: string;
  correlationId: string;
  createdAt: string;
}

export interface FulfillmentJob {
  id: string;
  status: FulfillmentJobStatus;
  attempts: number;
  lastError: string | null;
  bullJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  customerEmail: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payment: Payment | null;
  invoice: Invoice | null;
  fulfillmentJobs: FulfillmentJob[];
  events: OrderEvent[];
  lastEvent: OrderEvent | null;
}

/** Slim order shape returned by list queries (table + dashboard recent). */
export interface OrderListItem {
  id: string;
  customerEmail: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  lastEvent: Pick<OrderEvent, 'id' | 'type' | 'createdAt'> | null;
}

/** One day of segmented order counts for the throughput chart. */
export interface ThroughputDay {
  date: string;
  today: boolean;
  pending: number;
  paid: number;
  fulfilling: number;
  fulfilled: number;
  failed: number;
  total: number;
  hasFailedJob: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  unitPrice: number;
}

export interface DashboardMetrics {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  fulfilledOrders: number;
  failedJobs: number;
}
