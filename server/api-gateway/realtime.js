import { WebSocketServer, WebSocket } from 'ws';
import { registerGaugeCollector } from '../utils/metrics.js';

/**
 * Real-time channel for clients (ws://<gateway>/ws).
 *
 * The gateway sees every write that goes to the microservices, so it announces
 * successful catalog/stock changes here. Messages carry no business data — only
 * "something changed" — and clients reload through the normal REST APIs.
 */

const WS_PATH = '/ws';
const HEARTBEAT_MS = 30000;

let wss = null;

export function attachRealtime(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('error', () => {});
    socket.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));
  });

  // Drop connections that stopped answering pings (closed laptops, lost Wi-Fi…)
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_MS);
  wss.on('close', () => clearInterval(heartbeat));

  registerGaugeCollector({
    name: 'websocket_connections',
    help: 'Open real-time WebSocket clients on the gateway',
    read: () => [{ value: wss ? wss.clients.size : 0 }]
  });

  console.log(`🔌 WebSocket channel ready at ${WS_PATH}`);
  return wss;
}

export function broadcast(event) {
  if (!wss) return;
  const message = JSON.stringify({ ...event, at: new Date().toISOString() });
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}

// Writes that change what customers can see in the catalog.
// Read-only POSTs (stock checks) and image uploads are excluded.
const CATALOG_WRITE = /^\/api\/(products|inventory)(\/|$|\?)/;
const NOT_A_CATALOG_CHANGE = /^\/api\/(inventory\/check|products\/upload)(\/|$|\?)/;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ORDER_WRITE = /^\/api\/orders(\/|$|\?)/;
const SALE_WRITE = /^\/api\/sales(\/|$|\?)/;

/** Called by the proxy after a downstream response; announces successful catalog/order writes. */
export function announceIfCatalogChanged(req, status) {
  if (!WRITE_METHODS.has(req.method) || status < 200 || status >= 300) return;
  const url = req.originalUrl;
  if (SALE_WRITE.test(url)) {
    broadcast({ type: 'sales.updated' });
    // Recording a sale takes units out of stock
    if (req.method === 'POST') broadcast({ type: 'catalog.updated', source: 'sales' });
    return;
  }
  if (ORDER_WRITE.test(url)) {
    broadcast({ type: 'orders.updated' });
    // Stock changes from orders are announced from Kafka (StockReserved / StockRestored), see events.js
    return;
  }
  if (!CATALOG_WRITE.test(url) || NOT_A_CATALOG_CHANGE.test(url)) return;
  broadcast({
    type: 'catalog.updated',
    source: url.startsWith('/api/inventory') ? 'inventory' : 'products'
  });
}
