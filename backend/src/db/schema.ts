import { pgTable, text, integer, boolean, timestamp, json, uuid, pgEnum } from 'drizzle-orm/pg-core';

// Enums matching schema.prisma
export const roleEnum = pgEnum('Role', ['CUSTOMER', 'ADMIN']);
export const categoryTypeEnum = pgEnum('CategoryType', ['PULSA', 'KUOTA', 'WIFI', 'PREMIUM']);
export const paymentStatusEnum = pgEnum('PaymentStatus', [
  'UNPAID',
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUND_PENDING',
  'REFUNDED',
]);
export const fulfillmentStatusEnum = pgEnum('FulfillmentStatus', [
  'NOT_STARTED',
  'QUEUED',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'MANUAL_REVIEW',
]);
export const deliveryMethodEnum = pgEnum('DeliveryMethod', ['AUTOMATIC', 'MANUAL']);
export const voucherStatusEnum = pgEnum('VoucherStatus', ['AVAILABLE', 'RESERVED', 'SOLD']);

// 1. Users Table
export const users = pgTable('User', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  password: text('password'),
  role: roleEnum('role').default('CUSTOMER'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// 2. Products Table
export const products = pgTable('Product', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  categoryId: categoryTypeEnum('categoryId').notNull(),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  supplierSku: text('supplierSku'),
  nominal: integer('nominal'),
  description: text('description').notNull(),
  supplierPrice: integer('supplierPrice').notNull(),
  sellingPrice: integer('sellingPrice').notNull(),
  discountPrice: integer('discountPrice'),
  quotaDetails: text('quotaDetails'),
  duration: text('duration'),
  speed: text('speed'),
  networkLocation: text('networkLocation'),
  deliveryMethod: deliveryMethodEnum('deliveryMethod').default('AUTOMATIC'),
  isActive: boolean('isActive').default(true),
  stock: integer('stock').default(0),
  badge: text('badge'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// 3. Orders Table
export const orders = pgTable('Order', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceNumber: text('invoiceNumber').notNull().unique(),
  userId: text('userId').references(() => users.id),
  customerName: text('customerName'),
  customerEmail: text('customerEmail'),
  customerPhone: text('customerPhone'),
  targetDestination: text('targetDestination').notNull(),
  category: categoryTypeEnum('category').notNull(),
  subtotal: integer('subtotal').notNull(),
  adminFee: integer('adminFee').default(0).notNull(),
  discount: integer('discount').default(0).notNull(),
  promoCode: text('promoCode'),
  totalAmount: integer('totalAmount').notNull(),
  paymentStatus: paymentStatusEnum('paymentStatus').default('UNPAID').notNull(),
  fulfillmentStatus: fulfillmentStatusEnum('fulfillmentStatus').default('NOT_STARTED').notNull(),
  paymentMethod: text('paymentMethod'),
  deliveryMethod: deliveryMethodEnum('deliveryMethod').default('AUTOMATIC'),
  guestAccessToken: text('guestAccessToken').notNull().$defaultFn(() => crypto.randomUUID()),
  idempotencyKey: text('idempotencyKey').unique(),
  midtransSnapToken: text('midtransSnapToken'),
  midtransOrderId: text('midtransOrderId'),
  supplierRefId: text('supplierRefId'),
  serialNumber: text('serialNumber'),
  voucherCode: text('voucherCode'),
  voucherPassword: text('voucherPassword'),
  wifiSsid: text('wifiSsid'),
  wifiLoginUrl: text('wifiLoginUrl'),
  premiumNotes: text('premiumNotes'),
  errorReason: text('errorReason'),
  paidAt: timestamp('paidAt'),
  fulfilledAt: timestamp('fulfilledAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// 4. Order Items Table
export const orderItems = pgTable('OrderItem', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('orderId').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('productId').notNull().references(() => products.id),
  productName: text('productName').notNull(),
  provider: text('provider').notNull(),
  category: categoryTypeEnum('category').notNull(),
  sellingPrice: integer('sellingPrice').notNull(),
  deliveryMethod: deliveryMethodEnum('deliveryMethod').notNull(),
  targetNumberOrAccount: text('targetNumberOrAccount').notNull(),
  networkLocation: text('networkLocation'),
  customerNote: text('customerNote'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// 5. Payment Attempts Table
export const paymentAttempts = pgTable('PaymentAttempt', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('orderId').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  paymentMethod: text('paymentMethod').notNull(),
  snapToken: text('snapToken'),
  transactionId: text('transactionId'),
  amount: integer('amount').notNull(),
  status: paymentStatusEnum('status').default('PENDING').notNull(),
  rawPayload: json('rawPayload'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// 6. Wifi Voucher Batches Table
export const wifiVoucherBatches = pgTable('WifiVoucherBatch', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  location: text('location').notNull(),
  speedProfile: text('speedProfile').notNull(),
  duration: text('duration').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// 7. Wifi Voucher Items Table
export const wifiVoucherItems = pgTable('WifiVoucherItem', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  batchId: text('batchId').references(() => wifiVoucherBatches.id, { onDelete: 'set null' }),
  location: text('location').notNull(),
  packageDuration: text('packageDuration').notNull(),
  code: text('code').notNull().unique(),
  password: text('password'),
  status: voucherStatusEnum('status').default('AVAILABLE').notNull(),
  orderId: text('orderId').references(() => orders.id),
  reservedUntil: timestamp('reservedUntil'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// 8. Promo Codes Table
export const promoCodes = pgTable('PromoCode', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  discountAmount: integer('discountAmount').notNull(),
  minTransaction: integer('minTransaction').notNull(),
  description: text('description').notNull(),
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// 9. Digiflazz Logs Table
export const digiflazzLogs = pgTable('DigiflazzLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('orderId').references(() => orders.id, { onDelete: 'set null' }),
  buyerSkuCode: text('buyerSkuCode').notNull(),
  customerNo: text('customerNo').notNull(),
  refId: text('refId').notNull().unique(),
  status: text('status').notNull(),
  rc: text('rc'),
  sn: text('sn'),
  message: text('message'),
  requestBody: json('requestBody'),
  responseBody: json('responseBody'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// 10. Audit Logs Table
export const auditLogs = pgTable('AuditLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  action: text('action').notNull(),
  performedBy: text('performedBy').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
