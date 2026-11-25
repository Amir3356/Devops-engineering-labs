import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, TrendingUp, ShoppingCart, Receipt, Package, Coins, Warehouse } from 'lucide-react';

/**
 * Admin → Reports
 * Built only from data the dashboard already loads (and refreshes live over the WebSocket):
 *   orders    – customer payments (order-service)
 *   sales     – sales recorded by the admin (sale-service)
 *   inventory – stock, selling prices, batch ids (inventory-service)
 *   purchases – purchase batches with unit cost (purchase-service)
 */

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'custom', label: 'Custom date range' }
];
const DAY = 86400000;
const HOUR = 3600000;

const money = (n) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactMoney = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
// Local calendar date as YYYY-MM-DD (for <input type="date"> and file names)
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const fromDayKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const longDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Turn the chosen period into a time window [start, end) and a bucket size for the chart.
 * Today = midnight→now (hourly) · Weekly = this week from Monday · Monthly = this month from the 1st
 * Custom = From..To inclusive (daily, weekly when longer than 31 days)
 */
function periodWindow(period, now, customFrom, customTo) {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  if (period === 'today') {
    return { start: today, end: tomorrow, bucket: 'hour', label: `Today, ${longDate(today)}` };
  }
  if (period === 'week') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { start: monday, end: tomorrow, bucket: 'day', label: `This week (${shortDate(monday)} – ${shortDate(today)})` };
  }
  if (period === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: first,
      end: tomorrow,
      bucket: 'day',
      label: `This month (${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`
    };
  }
  const from = fromDayKey(customFrom);
  const to = fromDayKey(customTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: 'Choose both a From and a To date.' };
  }
  if (from > to) {
    return { error: '"From" must be on or before "To".' };
  }
  const end = new Date(to.getTime() + DAY);
  const days = Math.round((end - from) / DAY);
  return { start: from, end, bucket: days > 31 ? 'week' : 'day', label: `${longDate(from)} – ${longDate(to)}` };
}
const shortDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Round an axis maximum up to a clean number and return 4 evenly spaced ticks. */
function niceTicks(max) {
  if (!(max > 0)) return [0, 1, 2, 3, 4];
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough);
  return [0, 1, 2, 3, 4].map((i) => i * step);
}

export default function ReportsView({ orders = [], sales = [], inventory = [], purchases = [] }) {
  const [period, setPeriod] = useState('month');
  // "Now" is captured, not read during render; it refreshes whenever the period changes
  const [now, setNow] = useState(() => Date.now());
  const [customFrom, setCustomFrom] = useState(() => dayKey(Date.now() - 29 * DAY));
  const [customTo, setCustomTo] = useState(() => dayKey(Date.now()));
  const win = useMemo(() => periodWindow(period, now, customFrom, customTo), [period, now, customFrom, customTo]);

  // ---- cost lookup: inventory row → its purchase batch → unit cost (fallback: latest purchase by name)
  const unitCostFor = useMemo(() => {
    const byBatch = new Map(purchases.filter((p) => p.batchId).map((p) => [String(p.batchId), p]));
    const latestByName = new Map();
    [...purchases]
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .forEach((p) => latestByName.set(String(p.productName || '').toLowerCase(), p));
    const invById = new Map(inventory.map((i) => [String(i.productId), i]));
    return (productId, name) => {
      const inv = invById.get(String(productId));
      const purchase =
        (inv?.batchId && byBatch.get(String(inv.batchId))) || latestByName.get(String(name || '').toLowerCase());
      const cost = Number(purchase?.unitCost);
      return cost > 0 ? cost : null;
    };
  }, [inventory, purchases]);

  // ---- one list of revenue records from both sources
  const allRecords = useMemo(() => {
    const fromOrders = orders
      .filter((o) => o.status !== 'Cancelled')
      .map((o) => ({
        source: 'orders',
        date: new Date(o.createdAt),
        revenue: Number(o.totalAmount) || 0,
        lines: (o.items || []).map((i) => ({
          productId: i.productId,
          name: i.title || i.name || i.productId,
          category: i.category || '',
          qty: Number(i.quantity) || 0,
          amount: (Number(i.price) || 0) * (Number(i.quantity) || 0)
        }))
      }));
    const fromSales = sales.map((s) => ({
      source: 'sales',
      date: new Date(s.createdAt),
      revenue: Number(s.totalAmount) || 0,
      lines: [
        {
          productId: s.productId,
          name: s.productName,
          category: s.category || '',
          qty: Number(s.quantity) || 0,
          amount: Number(s.totalAmount) || 0
        }
      ]
    }));
    return [...fromOrders, ...fromSales].filter((r) => !Number.isNaN(r.date.getTime()));
  }, [orders, sales]);

  const records = useMemo(() => {
    if (win.error) return [];
    const from = win.start.getTime();
    const to = win.end.getTime();
    return allRecords.filter((r) => r.date.getTime() >= from && r.date.getTime() < to);
  }, [allRecords, win]);

  // ---- headline numbers
  const kpis = useMemo(() => {
    let ordersRevenue = 0;
    let salesRevenue = 0;
    let units = 0;
    let profit = 0;
    let costedAmount = 0;
    let lineAmount = 0;
    records.forEach((r) => {
      if (r.source === 'orders') ordersRevenue += r.revenue;
      else salesRevenue += r.revenue;
      r.lines.forEach((l) => {
        units += l.qty;
        lineAmount += l.amount;
        const cost = unitCostFor(l.productId, l.name);
        if (cost !== null) {
          profit += l.amount - cost * l.qty;
          costedAmount += l.amount;
        }
      });
    });
    const stockAtCost = inventory.reduce((sum, i) => {
      const cost = unitCostFor(i.productId, i.productName);
      return sum + (cost !== null ? cost * (Number(i.stockQuantity) || 0) : 0);
    }, 0);
    const stockAtPrice = inventory.reduce(
      (sum, i) => sum + (Number(i.unitSellingPrice) || 0) * (Number(i.stockQuantity) || 0),
      0
    );
    return {
      total: ordersRevenue + salesRevenue,
      ordersRevenue,
      salesRevenue,
      ordersCount: records.filter((r) => r.source === 'orders').length,
      salesCount: records.filter((r) => r.source === 'sales').length,
      units,
      profit,
      profitCoverage: lineAmount > 0 ? costedAmount / lineAmount : 1,
      stockAtCost,
      stockAtPrice
    };
  }, [records, inventory, unitCostFor]);

  // ---- revenue over time (hourly for Today, daily, or weekly for long custom ranges)
  const series = useMemo(() => {
    if (win.error) return { buckets: [], bucket: 'day' };
    const step = win.bucket === 'hour' ? HOUR : win.bucket === 'week' ? 7 * DAY : DAY;
    const buckets = [];
    for (let t = win.start.getTime(); t < win.end.getTime(); t += step) {
      buckets.push({ start: new Date(t), orders: 0, sales: 0 });
    }
    records.forEach((r) => {
      const idx = Math.min(buckets.length - 1, Math.floor((r.date.getTime() - win.start.getTime()) / step));
      if (idx >= 0) buckets[idx][r.source] += r.revenue;
    });
    return { buckets, bucket: win.bucket };
  }, [records, win]);

  // ---- product performance (also the chart's table view)
  const productRows = useMemo(() => {
    const map = new Map();
    records.forEach((r) =>
      r.lines.forEach((l) => {
        const key = String(l.productId || l.name);
        const row = map.get(key) || { key, productId: l.productId, name: l.name, category: l.category, units: 0, revenue: 0 };
        row.units += l.qty;
        row.revenue += l.amount;
        if (!row.category && l.category) row.category = l.category;
        map.set(key, row);
      })
    );
    const invById = new Map(inventory.map((i) => [String(i.productId), i]));
    return [...map.values()]
      .map((row) => {
        const cost = unitCostFor(row.productId, row.name);
        const totalCost = cost !== null ? cost * row.units : null;
        return {
          ...row,
          cost: totalCost,
          profit: totalCost !== null ? row.revenue - totalCost : null,
          stockLeft: invById.has(String(row.productId)) ? Number(invById.get(String(row.productId)).stockQuantity) || 0 : null
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [records, inventory, unitCostFor]);

  const exportCsv = () => {
    const header = ['Product', 'Category', 'Units sold', 'Revenue', 'Est. cost', 'Est. profit', 'Stock left'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = productRows.map((r) =>
      [r.name, r.category, r.units, r.revenue.toFixed(2), r.cost?.toFixed(2) ?? '', r.profit?.toFixed(2) ?? '', r.stockLeft ?? ''].map(cell).join(',')
    );
    const blob = new Blob([[header.map(cell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const span = win.error ? 'invalid' : `${dayKey(win.start)}_to_${dayKey(win.end.getTime() - DAY)}`;
    a.download = `nexus-report-${period}-${span}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-view viz-root">
      {/* Filters: one row above the charts */}
      <div className="reports-filter-row">
        <div className="reports-filter-field">
          <label htmlFor="reports-period">Period</label>
          <select
            id="reports-period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setNow(Date.now());
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div className="reports-filter-field">
              <label htmlFor="reports-from">From</label>
              <input
                id="reports-from"
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="reports-filter-field">
              <label htmlFor="reports-to">To</label>
              <input
                id="reports-to"
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}

        <span className={`reports-period-label ${win.error ? 'error' : ''}`} role={win.error ? 'alert' : undefined}>
          {win.error || win.label}
        </span>
      </div>

      {/* Headline numbers */}
      <div className="reports-kpi-grid">
        <Kpi icon={TrendingUp} label="Total revenue" value={money(kpis.total)} note={`${kpis.ordersCount + kpis.salesCount} transactions`} />
        <Kpi icon={ShoppingCart} label="Customer orders" value={money(kpis.ordersRevenue)} note={`${kpis.ordersCount} paid order(s)`} keyColor="var(--series-1)" />
        <Kpi icon={Receipt} label="Direct sales" value={money(kpis.salesRevenue)} note={`${kpis.salesCount} recorded sale(s)`} keyColor="var(--series-2)" />
        <Kpi icon={Package} label="Units sold" value={kpis.units.toLocaleString('en-US')} note="Orders + sales" />
        <Kpi
          icon={Coins}
          label="Gross profit (est.)"
          value={money(kpis.profit)}
          note={kpis.profitCoverage < 1 ? `Cost known for ${Math.round(kpis.profitCoverage * 100)}% of revenue` : 'Revenue − purchase cost'}
        />
        <Kpi icon={Warehouse} label="Stock value" value={money(kpis.stockAtPrice)} note={`At cost: ${money(kpis.stockAtCost)} · now`} />
      </div>

      {records.length === 0 ? (
        <div className="reports-empty">
          <h3>{win.error ? 'Choose a valid date range' : 'No revenue in this period'}</h3>
          <p>Customer payments and recorded sales will appear here as soon as they happen.</p>
        </div>
      ) : (
        <>
          <div className="reports-card">
            <div className="reports-card-head">
              <div>
                <h3>Revenue over time</h3>
                <p>
                  {series.bucket === 'hour' ? 'Hourly' : series.bucket === 'week' ? 'Weekly' : 'Daily'} revenue · {win.label}
                </p>
              </div>
              <div className="reports-legend" aria-label="Legend">
                <span><i className="swatch" style={{ background: 'var(--series-1)' }} /> Customer orders</span>
                <span><i className="swatch" style={{ background: 'var(--series-2)' }} /> Direct sales</span>
              </div>
            </div>
            <RevenueColumns buckets={series.buckets} bucket={series.bucket} />
          </div>

          <div className="reports-card">
            <div className="reports-card-head">
              <div>
                <h3>Top products by revenue</h3>
                <p>Customer orders and direct sales combined</p>
              </div>
            </div>
            <TopProductBars rows={productRows.slice(0, 8)} />
          </div>

          <div className="reports-card">
            <div className="reports-card-head">
              <div>
                <h3>Product performance</h3>
                <p>Estimated cost uses each product&apos;s purchase unit cost</p>
              </div>
              <button type="button" className="reports-export-btn" onClick={exportCsv}>
                <Download size={15} /> Export CSV
              </button>
            </div>
            <div className="reports-table-wrap">
              <table className="admin-table reports-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="num">Units sold</th>
                    <th className="num">Revenue</th>
                    <th className="num">Est. cost</th>
                    <th className="num">Est. profit</th>
                    <th className="num">Stock left</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((r) => (
                    <tr key={r.key}>
                      <td className="font-semibold">{r.name}</td>
                      <td>{r.category ? <span className="cat-tag">{r.category}</span> : '—'}</td>
                      <td className="num">{r.units}</td>
                      <td className="num font-semibold">{money(r.revenue)}</td>
                      <td className="num">{r.cost !== null ? money(r.cost) : '—'}</td>
                      <td className={`num ${r.profit !== null && r.profit < 0 ? 'reports-loss' : ''}`}>
                        {r.profit !== null ? money(r.profit) : '—'}
                      </td>
                      <td className="num">{r.stockLeft ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, note, keyColor }) {
  return (
    <div className="reports-kpi">
      <div className="reports-kpi-label">
        {keyColor ? <i className="swatch" style={{ background: keyColor }} /> : <Icon size={15} />}
        {label}
      </div>
      <div className="reports-kpi-value">{value}</div>
      <div className="reports-kpi-note">{note}</div>
    </div>
  );
}

/** Hover/focus tooltip positioned inside the chart container. */
function useTooltip() {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const show = (event, content) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const target = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX ?? target.left + target.width / 2) - box.left;
    const y = (event.clientY ?? target.top) - box.top;
    setTip({ x, y, content, flip: x > box.width - 240 }); // open to the left near the right edge
  };
  return { wrapRef, tip, show, hide: () => setTip(null), width };
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className={`reports-tooltip ${tip.flip ? 'flip' : ''}`} style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  );
}

/** Stacked columns: customer orders (bottom) + direct sales (top), one shared y-axis. */
function RevenueColumns({ buckets, bucket }) {
  const { wrapRef, tip, show, hide, width } = useTooltip();
  const W = width;
  const H = 260;
  const pad = { top: 16, right: 12, bottom: 30, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = Math.max(...buckets.map((b) => b.orders + b.sales), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const band = plotW / buckets.length;
  const barW = Math.min(24, Math.max(4, band * 0.6));
  const y = (v) => pad.top + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(buckets.length / Math.max(3, Math.floor(plotW / 90)));
  const GAP = 2; // surface gap between stacked segments
  const R = 4; // rounded data-end

  // Column path: square at the baseline, rounded at its data-end
  const columnPath = (x, yTop, yBottom, roundTop) => {
    const h = yBottom - yTop;
    if (h <= 0) return '';
    const r = roundTop ? Math.min(R, h, barW / 2) : 0;
    return `M${x},${yBottom} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + barW - r},${yTop} Q${x + barW},${yTop} ${x + barW},${yTop + r} L${x + barW},${yBottom} Z`;
  };

  return (
    <div className="reports-chart" ref={wrapRef} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue over time, customer orders and direct sales">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="reports-grid" />
            <text x={pad.left - 8} y={y(t)} className="reports-axis" textAnchor="end" dominantBaseline="middle">
              {compactMoney(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = pad.left + i * band + (band - barW) / 2;
          const yOrders = y(b.orders);
          const ySalesTop = y(b.orders + b.sales);
          const total = b.orders + b.sales;
          const label =
            bucket === 'hour'
              ? `${new Date(b.start).toLocaleTimeString('en-US', { hour: 'numeric' })} – ${new Date(b.start.getTime() + HOUR).toLocaleTimeString('en-US', { hour: 'numeric' })}`
              : bucket === 'week'
                ? `Week of ${shortDate(b.start)}`
                : new Date(b.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const axisLabel = bucket === 'hour' ? new Date(b.start).toLocaleTimeString('en-US', { hour: 'numeric' }) : shortDate(b.start);
          const content = (
            <>
              <div className="tt-title">{label}</div>
              <div className="tt-row"><i className="tt-key" style={{ background: 'var(--series-1)' }} /><strong>{money(b.orders)}</strong> Customer orders</div>
              <div className="tt-row"><i className="tt-key" style={{ background: 'var(--series-2)' }} /><strong>{money(b.sales)}</strong> Direct sales</div>
              <div className="tt-total"><strong>{money(total)}</strong> total</div>
            </>
          );
          return (
            <g key={i}>
              {b.orders > 0 && <path d={columnPath(x, yOrders, y(0), b.sales === 0)} fill="var(--series-1)" />}
              {b.sales > 0 && (
                <path d={columnPath(x, ySalesTop, (b.orders > 0 ? yOrders - GAP : y(0)), true)} fill="var(--series-2)" />
              )}
              {/* Hit target: the whole band, taller than the mark */}
              <rect
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={plotH}
                fill="transparent"
                className="reports-hit"
                tabIndex={0}
                aria-label={`${label}: customer orders ${money(b.orders)}, direct sales ${money(b.sales)}`}
                onMouseMove={(e) => show(e, content)}
                onFocus={(e) => show(e, content)}
                onBlur={hide}
              />
              {i % labelEvery === 0 && (
                <text x={pad.left + i * band + band / 2} y={H - 10} className="reports-axis" textAnchor="middle">
                  {axisLabel}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} className="reports-baseline" />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Horizontal bars, single series; value at the tip. */
function TopProductBars({ rows }) {
  const { wrapRef, tip, show, hide, width } = useTooltip();
  const W = width;
  const rowH = 34;
  const labelW = Math.min(190, Math.round(width * 0.3));
  const valueW = 96;
  const H = rows.length * rowH + 8;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  const barMax = W - labelW - valueW;
  const barH = 18;

  return (
    <div className="reports-chart" ref={wrapRef} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Top products by revenue">
        {rows.map((r, i) => {
          const w = Math.max(2, (r.revenue / max) * barMax);
          const yMid = 4 + i * rowH + rowH / 2;
          const x0 = labelW;
          const rr = Math.min(4, w / 2);
          const path = `M${x0},${yMid - barH / 2} L${x0 + w - rr},${yMid - barH / 2} Q${x0 + w},${yMid - barH / 2} ${x0 + w},${yMid - barH / 2 + rr} L${x0 + w},${yMid + barH / 2 - rr} Q${x0 + w},${yMid + barH / 2} ${x0 + w - rr},${yMid + barH / 2} L${x0},${yMid + barH / 2} Z`;
          const content = (
            <>
              <div className="tt-title">{r.name}</div>
              <div className="tt-row"><strong>{money(r.revenue)}</strong> revenue</div>
              <div className="tt-row"><strong>{r.units}</strong> units sold</div>
            </>
          );
          const shortName = r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name;
          return (
            <g key={r.key}>
              <text x={labelW - 12} y={yMid} className="reports-bar-label" textAnchor="end" dominantBaseline="middle">
                {shortName}
              </text>
              <path d={path} fill="var(--series-1)" />
              <text x={x0 + w + 8} y={yMid} className="reports-bar-value" dominantBaseline="middle">
                {compactMoney(r.revenue)}
              </text>
              <rect
                x={0}
                y={4 + i * rowH}
                width={W}
                height={rowH}
                fill="transparent"
                className="reports-hit"
                tabIndex={0}
                aria-label={`${r.name}: ${money(r.revenue)} revenue, ${r.units} units`}
                onMouseMove={(e) => show(e, content)}
                onFocus={(e) => show(e, content)}
                onBlur={hide}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
