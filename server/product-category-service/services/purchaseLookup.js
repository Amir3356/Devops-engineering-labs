import config from '../config/index.js';

const LOOKUP_TIMEOUT_MS = 3000;
const normalise = (name) => String(name || '').trim().toLowerCase();

/**
 * Asks purchase-service how many purchase batches exist for a product.
 * Purchases reference products by name, so the match is by (case-insensitive) name.
 * Throws a 503 error when purchase-service can't be reached, so callers fail closed.
 */
export async function countPurchasesForProduct(productName) {
  let body;
  try {
    const res = await fetch(`${config.PURCHASE_SERVICE_URL}/api/purchases`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`purchase-service responded ${res.status}`);
    body = await res.json();
  } catch (cause) {
    const err = new Error('Cannot verify purchase history right now (purchase service unavailable). Try again shortly.');
    err.status = 503;
    err.cause = cause;
    throw err;
  }
  const target = normalise(productName);
  return (Array.isArray(body?.data) ? body.data : []).filter((p) => normalise(p.productName) === target).length;
}
