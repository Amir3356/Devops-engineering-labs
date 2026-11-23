import { pick, toNumber, toInt, toStr, toIsoDate, listOf } from './_fields';

export const ORDER_STATUS = Object.freeze({
  PENDING: 'Pending',
  PAID: 'Paid',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
});

/** Order in which statuses appear on the tracking stepper. */
export const ORDER_STATUS_FLOW = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PAID,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
];

/**
 * @typedef {Object} OrderItem
 * @property {string} productId
 * @property {string} title
 * @property {number} price
 * @property {number} quantity
 * @property {number} subtotal
 */
export const createOrderItem = (raw = {}) => {
  const price = toNumber(pick(raw, 'price'));
  const quantity = toInt(pick(raw, 'quantity'), 1);
  return {
    productId: toStr(pick(raw, 'productId', 'product_id', 'id')),
    title: toStr(pick(raw, 'title', 'name', 'productName')),
    price,
    quantity,
    subtotal: toNumber(pick(raw, 'subtotal'), price * quantity),
  };
};

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} customerId
 * @property {string} customerPhone
 * @property {OrderItem[]} items
 * @property {number} totalAmount
 * @property {Object|null} shippingAddress
 * @property {string} status
 * @property {string} paymentId
 * @property {string} paymentStatus
 * @property {string|null} createdAt
 * @property {string|null} updatedAt
 */
export const createOrder = (raw = {}) => {
  let items = pick(raw, 'items');
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  const status = toStr(pick(raw, 'status'), ORDER_STATUS.PENDING);
  return {
    id: toStr(pick(raw, 'id', 'orderId', 'order_id')),
    customerId: toStr(pick(raw, 'customerId', 'customer_id')),
    customerPhone: toStr(pick(raw, 'customerPhone', 'customer_phone')),
    items: listOf(createOrderItem)(items),
    totalAmount: toNumber(pick(raw, 'totalAmount', 'total_amount')),
    shippingAddress: pick(raw, 'shippingAddress', 'shipping_address') || null,
    status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
    paymentId: toStr(pick(raw, 'paymentId', 'payment_id')),
    paymentStatus: toStr(pick(raw, 'paymentStatus', 'payment_status'), 'Pending'),
    createdAt: toIsoDate(pick(raw, 'createdAt', 'created_at')),
    updatedAt: toIsoDate(pick(raw, 'updatedAt', 'updated_at')),
  };
};

export const createOrderList = listOf(createOrder);

export const isCancellable = (order) =>
  order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.PAID;

/** Index of the order on ORDER_STATUS_FLOW (-1 when cancelled). */
export const orderProgress = (order) => ORDER_STATUS_FLOW.indexOf(order.status);
