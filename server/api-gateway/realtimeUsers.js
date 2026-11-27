import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { WebSocket } from 'ws';
import config from './config/index.js';
import { isTokenVersionValid } from '../utils/tokenVersion.js';
import { registerGaugeCollector } from '../utils/metrics.js';

/**
 * Per-user real-time delivery over the gateway WebSocket.
 *
 * 1. A socket becomes "user X" by authenticating:
 *      - message {"type":"auth","token":"<JWT>"} (the client sends it on every (re)connect / login), or
 *      - the HttpOnly session cookie on the upgrade request — accepted ONLY from WS_ALLOWED_ORIGINS,
 *        so another website cannot open a socket with the user's cookie (cross-site WebSocket hijacking).
 *    {"type":"auth","token":null} logs the socket out (client logout).
 * 2. notification-service publishes to Redis channel notifications:user:<id>.
 * 3. Every gateway replica pattern-subscribes to notifications:user:* and sends the message to the
 *    sockets of that user it holds — so the gateway scales horizontally without sticky sessions.
 *
 * Env: REDIS_URL, JWT_SECRET, WS_ALLOWED_ORIGINS (comma separated, default http://localhost:3000).
 */

const ALLOWED_ORIGINS = new Set(
  (process.env.WS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
);
const CHANNEL_PATTERN = 'notifications:user:*';

const userSockets = new Map(); // userId → Set<WebSocket>

function bind(socket, userId) {
  unbind(socket);
  socket.userId = userId;
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket);
}

export function unbind(socket) {
  const { userId } = socket;
  if (!userId) return;
  const set = userSockets.get(userId);
  set?.delete(socket);
  if (set && set.size === 0) userSockets.delete(userId);
  socket.userId = null;
}

async function verify(token) {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  const userId = String(decoded.id || decoded.userId || '');
  if (!userId) throw new Error('token has no user id');
  // Same revocation check as the HTTP auth middleware (logout-everywhere / password change)
  if (!(await isTokenVersionValid(userId, decoded.tokenVersion).catch(() => true))) {
    throw new Error('session revoked');
  }
  return userId;
}

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function reply(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

/** Try the session cookie on connect (trusted origins only). */
export async function authenticateFromUpgrade(socket, req) {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return;
  const token = readCookie(req.headers.cookie, config.COOKIE?.NAME || 'token');
  if (!token) return;
  try {
    bind(socket, await verify(token));
    reply(socket, { type: 'auth.ok', via: 'cookie' });
  } catch {
    // stay anonymous; the client can still send an auth message
  }
}

/** Handle {"type":"auth","token":…} messages. Returns true when the message was an auth message. */
export async function handleAuthMessage(socket, raw) {
  let msg;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    return false;
  }
  if (msg?.type !== 'auth') return false;
  if (!msg.token) {
    unbind(socket);
    reply(socket, { type: 'auth.cleared' });
    return true;
  }
  try {
    bind(socket, await verify(String(msg.token)));
    reply(socket, { type: 'auth.ok', via: 'token' });
  } catch (err) {
    unbind(socket);
    reply(socket, { type: 'auth.error', message: err.message });
  }
  return true;
}

/** Send to every open socket of one user (on this replica). Returns the number of sockets reached. */
export function sendToUser(userId, payload) {
  const sockets = userSockets.get(String(userId));
  if (!sockets) return 0;
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let sent = 0;
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
      sent += 1;
    }
  }
  return sent;
}

/** Subscribe to notifications:user:* on Redis and forward each message to that user's sockets. */
export function startUserChannelRelay() {
  if (!process.env.REDIS_URL) {
    console.warn('[Realtime] REDIS_URL not set — per-user notifications disabled');
    return null;
  }
  const subscriber = createClient({
    url: process.env.REDIS_URL,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 500, 5000) }
  });
  subscriber.on('error', () => {});
  subscriber.on('ready', () => console.log('[Realtime] Relaying per-user notifications from Redis'));
  subscriber
    .connect()
    .then(() =>
      // node-redis re-subscribes automatically after a reconnect
      subscriber.pSubscribe(CHANNEL_PATTERN, (message, channel) => {
        const userId = channel.slice(CHANNEL_PATTERN.length - 1);
        sendToUser(userId, message);
      })
    )
    .catch((err) => console.warn('[Realtime] Redis subscribe failed:', err.message));

  registerGaugeCollector({
    name: 'websocket_authenticated_users',
    help: 'Distinct users with at least one authenticated WebSocket on this gateway',
    read: () => [{ value: userSockets.size }]
  });
  return subscriber;
}
