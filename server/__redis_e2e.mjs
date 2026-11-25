import dotenv from 'dotenv'; dotenv.config({ path: '.env', quiet: true });
import axios from 'axios';
const G = 'http://localhost:5000';
const svc = { product: 'http://localhost:5002', inventory: 'http://localhost:5006', policy: 'http://localhost:5009', user: 'http://localhost:5001' };

const axFetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  const data = opts.body ? (typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body) : undefined;
  const res = await axios({
    url,
    method,
    headers: opts.headers,
    data,
    validateStatus: () => true
  });
  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    json: async () => res.data,
    data: res.data
  };
};

const health = async (s) => (await (await axFetch(svc[s] + '/health')).json()).data.cache;
const timed = async (url, opts) => { const t = performance.now(); const r = await axFetch(url, opts); const b = await r.json(); return { ms: +(performance.now() - t).toFixed(1), body: b, status: r.status }; };
const admin = await (await axFetch(G + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) })).json();
const AH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + admin.data.token };
let prod;
try {
  // 1. hit vs miss
  const p0 = await health('product');
  const a = await timed(G + '/api/products'); const b = await timed(G + '/api/products'); const c = await timed(G + '/api/products');
  const p1 = await health('product');
  console.log(`1  products  : 1st ${a.ms}ms, 2nd ${b.ms}ms, 3rd ${c.ms}ms | misses +${p1.misses - p0.misses} (DB queries), hits +${p1.hits - p0.hits}`);
  const i0 = await health('inventory');
  await timed(G + '/api/inventory'); await timed(G + '/api/inventory');
  const i1 = await health('inventory');
  console.log(`1  inventory : misses +${i1.misses - i0.misses}, hits +${i1.hits - i0.hits}`);

  // 2a. new product appears immediately (cache cleared on write)
  prod = (await (await axFetch(G + '/api/products', { method: 'POST', headers: AH, body: JSON.stringify({ name: 'Cache Test Lamp', category: 'Accessories', description: 'x', price: 0, stock: 0 }) })).json()).data;
  const listed = (await (await axFetch(G + '/api/products')).json()).data.some((p) => p.id === prod.id);
  console.log(`2a create    : new product in the very next list read? ${listed}`);
  // 2b. stock written -> next read is fresh
  await axFetch(G + '/api/inventory/replenish', { method: 'POST', headers: AH, body: JSON.stringify({ productId: prod.id, amount: 5, productName: prod.name, category: 'Accessories', batchId: 'BAT-CACHE', totalSellingPrice: 50 }) });
  await axFetch(G + '/api/inventory'); // warm the cache
  await axFetch(G + '/api/inventory/replenish', { method: 'POST', headers: AH, body: JSON.stringify({ productId: prod.id, amount: 3 }) });
  const stockAfter = (await (await axFetch(G + '/api/inventory')).json()).data.find((r) => r.productId === prod.id)?.stockQuantity;
  console.log(`2b stock     : 5 + 3 replenished -> list shows ${stockAfter} (expected 8)`);
  // 3. checkout deduction still hits PostgreSQL, cache cleared after
  await axFetch(G + '/api/sales', { method: 'POST', headers: AH, body: JSON.stringify({ productId: prod.id, productName: prod.name, category: 'Accessories', quantity: 2 }) }).then(async (r) => { const j = await r.json(); globalThis.saleId = j.data?.id; });
  const afterSale = (await (await axFetch(G + '/api/inventory')).json()).data.find((r) => r.productId === prod.id)?.stockQuantity;
  const over = await axFetch(G + '/api/sales', { method: 'POST', headers: AH, body: JSON.stringify({ productId: prod.id, productName: prod.name, category: 'Accessories', quantity: 99 }) });
  console.log(`3  sale      : sold 2 -> list shows ${afterSale} (expected 6); oversell 99 -> ${over.status}`);
  // 2c. policy
  const pol0 = (await (await axFetch(G + '/api/policies/inventory-alerts')).json()).data.settings.lowStockThreshold;
  await axFetch(G + '/api/policies/inventory-alerts', { method: 'PUT', headers: AH, body: JSON.stringify({ lowStockThreshold: 7 }) });
  const pol1 = (await (await axFetch(G + '/api/policies/inventory-alerts')).json()).data.settings.lowStockThreshold;
  await axFetch(G + '/api/policies/inventory-alerts', { method: 'PUT', headers: AH, body: JSON.stringify({ lowStockThreshold: pol0 }) });
  const pol2 = (await (await axFetch(G + '/api/policies/inventory-alerts')).json()).data.settings.lowStockThreshold;
  console.log(`2c policy    : ${pol0} -> saved 7 -> read ${pol1} -> restored -> read ${pol2}`);

  // 2d. user profile (cached on read, invalidated on profile update)
  const u0 = await health('user');
  const up1 = await timed(G + '/api/users/profile', { headers: AH });
  const up2 = await timed(G + '/api/users/profile', { headers: AH });
  const u1 = await health('user');
  console.log(`2d profile   : 1st ${up1.ms}ms, 2nd ${up2.ms}ms | misses +${u1.misses - u0.misses}, hits +${u1.hits - u0.hits}`);

  const origName = up1.body.data.name;
  await axFetch(G + '/api/users/profile', { method: 'PUT', headers: AH, body: JSON.stringify({ name: origName + ' Cached' }) });
  const upAfterUpdate = (await (await axFetch(G + '/api/users/profile', { headers: AH })).json()).data.name;
  await axFetch(G + '/api/users/profile', { method: 'PUT', headers: AH, body: JSON.stringify({ name: origName }) });
  const upRestored = (await (await axFetch(G + '/api/users/profile', { headers: AH })).json()).data.name;
  console.log(`2d update    : updated name '${upAfterUpdate}' -> restored '${upRestored}'`);
} finally {
  if (globalThis.saleId) await axFetch(G + '/api/sales/' + globalThis.saleId, { method: 'DELETE', headers: AH });
  if (prod) { await axFetch(G + '/api/inventory/' + prod.id, { method: 'DELETE', headers: AH }); await axFetch(G + '/api/products/' + prod.id, { method: 'DELETE', headers: AH }); }
  console.log('cleanup     : test sale, stock and product removed');
}
