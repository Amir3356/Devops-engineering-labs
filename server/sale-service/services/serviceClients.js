import axios from 'axios';
import config from '../config/index.js';

async function post(baseUrl, path, body, headers = {}, timeoutMs = 5000) {
  let res;
  try {
    res = await axios({
      url: `${baseUrl}${path}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      data: body,
      timeout: timeoutMs,
      validateStatus: () => true
    });
  } catch (cause) {
    const err = new Error(`Service at ${baseUrl} is unavailable`);
    err.status = 503;
    err.cause = cause;
    throw err;
  }
  const payload = res.data || {};
  if (res.status < 200 || res.status >= 300 || payload.success === false) {
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
