import config from '../config/index.js';

const TIMEOUT_MS = 5000;

async function call(path, body, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(`${config.INVENTORY_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (cause) {
    const err = new Error('Inventory service is unavailable, payment was not taken. Please try again.');
    err.status = 503;
    err.cause = cause;
    throw err;
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const err = new Error(payload.message || `Inventory service responded ${res.status}`);
    err.status = res.status === 400 ? 409 : res.status; // not enough stock -> conflict
    throw err;
  }
  return payload.data;
}

/** Take the ordered units out of stock (all items or none). */
export function deductStockForOrder(items) {
  return call('/api/inventory/deduct', {
    items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
  });
}

/** Compensation: put units back when the order could not be saved. */
export async function restoreStockForOrder(items) {
  for (const i of items) {
    // Internal service-to-service call; inventory's replenish route expects an admin role header
    await call('/api/inventory/replenish', { productId: i.productId, amount: Number(i.quantity) }, { 'x-user-role': 'admin' });
  }
}
