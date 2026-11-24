import config from '../config/index.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ask notification-service to email the order receipt (SMTP).
 * Runs in the background: the customer's payment response doesn't wait for the mail server.
 * @returns {{status: 'queued'|'skipped', to?: string, reason?: string}}
 */
export function queueOrderReceipt({ to, customerName, order }) {
  if (!EMAIL.test(String(to || ''))) {
    return { status: 'skipped', reason: 'No email address on this account' };
  }
  fetch(`${config.NOTIFICATION_SERVICE_URL}/internal/email/order-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      customerName,
      orderId: order.id,
      items: order.items,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt
    }),
    signal: AbortSignal.timeout(90000) // background job; the customer never waits for this
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.message || `notification-service responded ${res.status}`);
      console.log(`[Order Service] Receipt for ${order.id} emailed to ${to}`);
    })
    .catch((err) => console.error(`[Order Service] Receipt email for ${order.id} failed:`, err.message));
  return { status: 'queued', to };
}
