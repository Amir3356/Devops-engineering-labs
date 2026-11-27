import CustomerNotifications from '../features/notifications/CustomerNotifications';
import { useNotifications } from '../context/NotificationContext';

/**
 * NotificationsPage — the logged-in user's in-app notifications (live over the WebSocket).
 */
export default function NotificationsPage() {
  const { notifications, markRead, markAllRead } = useNotifications();
  return (
    <CustomerNotifications notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead} />
  );
}
