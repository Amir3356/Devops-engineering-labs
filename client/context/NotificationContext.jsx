import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { subscribeRealtime } from '../services/realtime.service';
import {
  getNotificationsApi,
  getUnreadCountApi,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi
} from '../api/notification.api';
import { createNotification, createNotificationList } from '../models';

/**
 * In-app notifications for the logged-in user, kept live over the gateway WebSocket.
 *
 *   load:      GET /api/notifications + /unread-count (on login, and after every reconnect to
 *              catch anything missed while offline)
 *   live:      notification.new  → prepend + toast + new unread count
 *              notification.read → mark read (also when read in another tab) + new unread count
 *   actions:   markRead(id), markAllRead()
 *
 * State is tagged with the user it belongs to, so after a logout or user switch the previous
 * user's notifications are never shown (no reset effect needed).
 */
const NotificationContext = createContext(null);
const EMPTY = { owner: null, items: [], unread: 0 };

async function fetchSnapshot(owner) {
  const [list, unread] = await Promise.all([getNotificationsApi({ limit: 50 }), getUnreadCountApi()]);
  return { owner, items: createNotificationList(list?.data || []), unread: Number(unread?.data?.count) || 0 };
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const sessionId = isAuthenticated ? String(user?.id ?? user?.email ?? 'me') : null;
  const [state, setState] = useState(EMPTY);

  const mine = state.owner !== null && state.owner === sessionId;
  const notifications = mine ? state.items : EMPTY.items;
  const unreadCount = mine ? state.unread : 0;

  // Apply an update only if it still belongs to the current session
  const update = useCallback(
    (fn) => setState((prev) => (prev.owner === sessionId ? fn(prev) : prev)),
    [sessionId]
  );

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      setState(await fetchSnapshot(sessionId));
    } catch {
      // keep what we have; the next reconnect or action retries
    }
  }, [sessionId]);

  // Load on login / user switch (ignores a late response from a previous session)
  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    fetchSnapshot(sessionId)
      .then((snapshot) => {
        if (!cancelled) setState(snapshot);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Live updates pushed by the gateway for this user only
  useEffect(() => {
    if (!sessionId) return undefined;
    return subscribeRealtime((event) => {
      if (event.type === 'notification.new' && event.notification) {
        const n = createNotification(event.notification);
        update((prev) => ({
          ...prev,
          items: prev.items.some((p) => p.id === n.id) ? prev.items : [n, ...prev.items],
          unread: Number(event.unreadCount) || 0
        }));
        const show = n.type === 'alert' ? toast.error : n.type === 'success' ? toast.success : toast.info;
        show(n.title, { description: n.message });
      } else if (event.type === 'notification.read') {
        const ids = new Set(event.ids || []);
        update((prev) => ({
          ...prev,
          items: prev.items.map((p) => (ids.has(p.id) ? { ...p, isRead: true } : p)),
          unread: Number(event.unreadCount) || 0
        }));
      } else if (event.type === 'connection.open') {
        refresh(); // resync after (re)connecting
      }
    });
  }, [sessionId, refresh, update]);

  const markRead = useCallback(
    async (id) => {
      // Optimistic; the server's notification.read event confirms the count
      update((prev) => ({
        ...prev,
        items: prev.items.map((p) => (p.id === id ? { ...p, isRead: true } : p)),
        unread: Math.max(0, prev.unread - 1)
      }));
      try {
        await markNotificationAsReadApi(id);
      } catch {
        refresh();
      }
    },
    [update, refresh]
  );

  const markAllRead = useCallback(async () => {
    update((prev) => ({ ...prev, items: prev.items.map((p) => ({ ...p, isRead: true })), unread: 0 }));
    try {
      await markAllNotificationsAsReadApi();
    } catch {
      refresh();
    }
  }, [update, refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, refresh, markRead, markAllRead }),
    [notifications, unreadCount, refresh, markRead, markAllRead]
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its provider
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
