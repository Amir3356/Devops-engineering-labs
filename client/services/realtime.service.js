/**
 * Real-time client for the API Gateway WebSocket (ws://<gateway>/ws).
 *
 * One shared connection for the whole app, with automatic reconnect
 * (exponential backoff, capped at 30s). Subscribers receive every message and
 * are told when the connection is (re)established, so they can resync anything
 * they may have missed while disconnected.
 */

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:5000';
const WS_URL = `${GATEWAY_URL.replace(/^http/, 'ws')}/ws`;
const MAX_BACKOFF_MS = 30000;

const listeners = new Set();
let socket = null;
let retryDelay = 1000;
let retryTimer = null;

function notify(event) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('[realtime] listener failed:', err);
    }
  });
}

function connect() {
  if (socket || listeners.size === 0) return;
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    retryDelay = 1000;
    notify({ type: 'connection.open' });
  };

  socket.onmessage = (msg) => {
    try {
      notify(JSON.parse(msg.data));
    } catch {
      // ignore malformed messages
    }
  };

  socket.onclose = () => {
    socket = null;
    if (listeners.size === 0) return;
    notify({ type: 'connection.closed' });
    retryTimer = setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_BACKOFF_MS);
  };

  socket.onerror = () => socket?.close();
}

/**
 * Listen for real-time events. Returns an unsubscribe function.
 * The connection opens with the first subscriber and closes with the last.
 */
export function subscribeRealtime(listener) {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(retryTimer);
      retryTimer = null;
      if (socket) {
        const s = socket;
        socket = null;
        s.onclose = null;
        s.close();
      }
    }
  };
}
