/**
 * GraphQL schema (SDL).
 *
 * Design choices for a small, dependency-light API:
 *  - DateTime values are returned as ISO-8601 strings.
 *  - Event `payload` is returned as a JSON string the client can parse.
 * This avoids pulling in custom-scalar libraries while keeping the contract clear.
 */
export const typeDefs = /* GraphQL */ `
  enum OrderStatus {
    PENDING
    PAID
    FULFILLING
    FULFILLED
    FAILED
  }

  enum PaymentStatus {
    SUCCEEDED
    FAILED
  }

  enum InvoiceStatus {
    ISSUED
  }

  enum FulfillmentJobStatus {
    QUEUED
    PROCESSING
    COMPLETED
    FAILED
  }

  type OrderItem {
    id: ID!
    sku: String!
    name: String!
    quantity: Int!
    unitPrice: Int!
  }

  type Payment {
    id: ID!
    amount: Int!
    status: PaymentStatus!
    providerEventId: String!
    createdAt: String!
  }

  type Invoice {
    id: ID!
    invoiceNumber: String!
    amount: Int!
    status: InvoiceStatus!
    createdAt: String!
  }

  type OrderEvent {
    id: ID!
    type: String!
    payload: String!
    correlationId: String!
    createdAt: String!
  }

  type FulfillmentJob {
    id: ID!
    status: FulfillmentJobStatus!
    attempts: Int!
    lastError: String
    bullJobId: String
    createdAt: String!
    updatedAt: String!
  }

  type Order {
    id: ID!
    customerEmail: String!
    totalAmount: Int!
    status: OrderStatus!
    createdAt: String!
    updatedAt: String!
    items: [OrderItem!]!
    payment: Payment
    invoice: Invoice
    fulfillmentJobs: [FulfillmentJob!]!
    events: [OrderEvent!]!
    lastEvent: OrderEvent
  }

  type InventoryItem {
    id: ID!
    sku: String!
    name: String!
    stock: Int!
    unitPrice: Int!
  }

  type DashboardMetrics {
    totalOrders: Int!
    pendingOrders: Int!
    paidOrders: Int!
    fulfilledOrders: Int!
    failedJobs: Int!
  }

  type RetryResult {
    ok: Boolean!
    message: String!
    orderId: ID!
    status: OrderStatus!
  }

  input CreateOrderItemInput {
    sku: String!
    quantity: Int!
  }

  input CreateOrderInput {
    customerEmail: String!
    items: [CreateOrderItemInput!]!
  }

  type Query {
    orders(status: OrderStatus): [Order!]!
    order(id: ID!): Order
    dashboardMetrics: DashboardMetrics!
    inventoryItems: [InventoryItem!]!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    retryFulfillment(orderId: ID!): RetryResult!
  }
`;
