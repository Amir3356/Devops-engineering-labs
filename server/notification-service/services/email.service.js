import nodemailer from 'nodemailer';

/**
 * Outgoing email over SMTP (nodemailer).
 * Credentials come only from the environment (server/.env) — never from code:
 *   SMTP_USER          the sending mailbox, e.g. your Gmail address
 *   SMTP_APP_PASSWORD  a Gmail "App password" (not your normal password)
 * Optional: SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), SMTP_SECURE (true for 465), MAIL_FROM_NAME.
 */

let transporter = null;

const readConfig = () => {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_APP_PASSWORD || '').replace(/\s+/g, ''); // Gmail shows app passwords in groups of 4
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  return {
    user,
    pass,
    host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    fromName: (process.env.MAIL_FROM_NAME || 'NexusCommerce').trim()
  };
};

export const isEmailConfigured = () => {
  const { user, pass } = readConfig();
  return Boolean(user && pass);
};

function getTransporter() {
  if (transporter) return transporter;
  const cfg = readConfig();
  if (!cfg.user || !cfg.pass) {
    const err = new Error('Email is not configured: set SMTP_USER and SMTP_APP_PASSWORD in server/.env');
    err.status = 503;
    throw err;
  }
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15000, // TCP/TLS connect
    greetingTimeout: 15000, // server greeting after connect
    socketTimeout: 60000 // any single SMTP step
  });
  return transporter;
}

/** Check the SMTP login once at startup so misconfiguration shows up in the logs. */
export async function verifyEmailTransport() {
  if (!isEmailConfigured()) {
    console.warn('[Notification Service] Email disabled: SMTP_USER / SMTP_APP_PASSWORD not set in server/.env');
    return false;
  }
  try {
    await getTransporter().verify();
    console.log('[Notification Service] SMTP login OK — email notifications enabled');
    return true;
  } catch (err) {
    console.error('[Notification Service] SMTP login failed:', err.message);
    return false;
  }
}

/** Send and log the outcome here, so it's visible even if the caller stopped waiting. */
async function deliver(message) {
  const started = Date.now();
  console.log(`[Notification Service] Sending "${message.subject}" to ${message.to}…`);
  try {
    const info = await getTransporter().sendMail(message);
    console.log(`[Notification Service] Sent to ${message.to} in ${Date.now() - started}ms (${info.messageId})`);
    return { messageId: info.messageId, accepted: info.accepted };
  } catch (err) {
    console.error(`[Notification Service] Sending to ${message.to} failed after ${Date.now() - started}ms:`, err.message);
    throw err;
  }
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/** Email the customer a receipt for an order they paid for in the shop. */
export async function sendOrderReceipt({ to, customerName, orderId, items = [], totalAmount, createdAt }) {
  const { user, fromName } = readConfig();
  const date = new Date(createdAt || Date.now()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const name = customerName || 'there';
  const lines = items.map((i) => ({
    title: i.title || i.productId,
    category: i.category || '',
    quantity: Number(i.quantity) || 1,
    price: Number(i.price) || 0
  }));
  const itemsTotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const shipping = Math.max(0, Math.round(((Number(totalAmount) || 0) - itemsTotal) * 100) / 100);

  const text = [
    `Hi ${name},`,
    '',
    `Thank you for your order. Your payment was successful.`,
    `Order: ${orderId}   Date: ${date}`,
    '',
    ...lines.map((l) => `  ${l.quantity} x ${l.title}${l.category ? ` (${l.category})` : ''}  ${money(l.price * l.quantity)}`),
    ...(shipping > 0 ? [`  Shipping  ${money(shipping)}`] : []),
    `  Total paid: ${money(totalAmount)}`,
    '',
    `— ${fromName}`
  ].join('\n');

  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eef2f0">${escapeHtml(l.title)}${l.category ? `<div style="font-size:12px;color:#61706a">${escapeHtml(l.category)}</div>` : ''}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eef2f0;text-align:center">${l.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eef2f0;text-align:right">${money(l.price * l.quantity)}</td>
      </tr>`
    )
    .join('');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:540px;margin:0 auto;color:#14231b">
    <div style="background:#173d29;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:700">${escapeHtml(fromName)}</div>
      <div style="font-size:13px;opacity:.8">Order confirmation &amp; receipt</div>
    </div>
    <div style="border:1px solid #e2e8e5;border-top:none;padding:24px;border-radius:0 0 12px 12px">
      <p style="margin:0 0 8px">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px">Thank you for your order — your payment was successful.</p>
      <p style="margin:0 0 16px;font-size:13px;color:#61706a">Order <strong style="color:#14231b">${escapeHtml(orderId)}</strong> · ${escapeHtml(date)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="color:#61706a;font-size:12px;text-transform:uppercase">
          <th style="text-align:left;padding-bottom:6px">Product</th><th style="padding-bottom:6px">Qty</th><th style="text-align:right;padding-bottom:6px">Amount</th>
        </tr>
        ${rows}
        ${shipping > 0 ? `<tr><td style="padding:8px 0;color:#61706a">Shipping</td><td></td><td style="padding:8px 0;text-align:right">${money(shipping)}</td></tr>` : ''}
        <tr><td style="padding:12px 0 0;font-weight:700">Total paid</td><td></td><td style="padding:12px 0 0;text-align:right;font-weight:700;color:#1f7a4f">${money(totalAmount)}</td></tr>
      </table>
      <p style="margin:20px 0 0;display:inline-block;background:#16a34a;color:#fff;font-weight:700;font-size:12px;padding:4px 12px;border-radius:999px">Paid</p>
    </div>
  </div>`;

  return deliver({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `Order ${orderId} confirmed — ${money(totalAmount)} paid`,
    text,
    html
  });
}

/** Email the customer a receipt for a sale recorded by the admin. */
export async function sendSaleReceipt({ to, customerName, saleId, productName, category, quantity, unitPrice, totalAmount, createdAt }) {
  const { user, fromName } = readConfig();
  const date = new Date(createdAt || Date.now()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const name = customerName && customerName !== 'Direct Customer' ? customerName : 'there';

  const text = [
    `Hi ${name},`,
    '',
    `Thank you for your purchase. Here is your receipt (${saleId}):`,
    '',
    `  Product:    ${productName}${category ? ` (${category})` : ''}`,
    `  Quantity:   ${quantity}`,
    `  Unit price: ${money(unitPrice)}`,
    `  Total paid: ${money(totalAmount)}`,
    `  Date:       ${date}`,
    '',
    `— ${fromName}`
  ].join('\n');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14231b">
    <div style="background:#173d29;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:700">${escapeHtml(fromName)}</div>
      <div style="font-size:13px;opacity:.8">Payment receipt</div>
    </div>
    <div style="border:1px solid #e2e8e5;border-top:none;padding:24px;border-radius:0 0 12px 12px">
      <p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px">Thank you for your purchase. Here is your receipt.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#61706a">Receipt</td><td style="padding:6px 0;text-align:right">${escapeHtml(saleId)}</td></tr>
        <tr><td style="padding:6px 0;color:#61706a">Product</td><td style="padding:6px 0;text-align:right">${escapeHtml(productName)}${category ? ` <span style="color:#61706a">(${escapeHtml(category)})</span>` : ''}</td></tr>
        <tr><td style="padding:6px 0;color:#61706a">Quantity</td><td style="padding:6px 0;text-align:right">${escapeHtml(quantity)}</td></tr>
        <tr><td style="padding:6px 0;color:#61706a">Unit price</td><td style="padding:6px 0;text-align:right">${money(unitPrice)}</td></tr>
        <tr><td style="padding:10px 0 6px;border-top:1px solid #e2e8e5;font-weight:700">Total paid</td><td style="padding:10px 0 6px;border-top:1px solid #e2e8e5;text-align:right;font-weight:700;color:#1f7a4f">${money(totalAmount)}</td></tr>
        <tr><td style="padding:6px 0;color:#61706a">Date</td><td style="padding:6px 0;text-align:right">${escapeHtml(date)}</td></tr>
      </table>
    </div>
  </div>`;

  return deliver({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `Your ${fromName} receipt — ${productName} (${money(totalAmount)})`,
    text,
    html
  });
}
