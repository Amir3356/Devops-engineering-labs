import config from '../config/index.js';

async function post(baseUrl, path, body, headers = {}, timeoutMs = 5000) {
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (cause) {
    const err = new Error(`Service at ${baseUrl} is unavailable`);
    err.status = 503;
    err.cause = cause;
    throw err;
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const err = new Error(payload.message || `Service responded ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return payload.data;
}

/** Take units out of stock. Returns the updated inventory row (incl. unitSellingPrice). */
export async function deductStock(productId, quantity) {
  try {
    const rows = await post(config.INVENTORY_SERVICE_URL, '/api/inventory/deduct', { items: [{ productId, quantity }] });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (err) {
    if (err.status === 400) err.status = 409; // not enough stock
    throw err;
  }
}

/** Compensation when the sale could not be saved. */
export function restoreStock(productId, quantity) {
  return post(config.INVENTORY_SERVICE_URL, '/api/inventory/replenish', { productId, amount: quantity }, { 'x-user-role': 'admin' });
}

/** Ask notification-service to email the receipt (SMTP). */
export function sendReceiptEmail(details) {
  return post(config.NOTIFICATION_SERVICE_URL, '/internal/email/sale-receipt', details, {}, 90000);
}
