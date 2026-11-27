import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

/**
 * Bell with a live unread badge (updated over the WebSocket — no polling).
 * `variant="nav"` for the top navbar, `variant="sidebar"` for the dashboard sidebars.
 */
export default function NotificationBell({ onClick, active = false, variant = 'nav', label = 'Notifications' }) {
  const { unreadCount } = useNotifications();
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const title = unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'No unread notifications';

  if (variant === 'sidebar') {
    return (
      <button type="button" className={`admin-nav-item ${active ? 'active' : ''}`} onClick={onClick} title={title}>
        <Bell size={18} />
        <span>{label}</span>
        {unreadCount > 0 && <span className="notif-bell-badge notif-bell-badge--inline">{badge}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`nav-btn notif-bell-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Bell size={16} />
      <span className="notif-bell-label">{label}</span>
      {unreadCount > 0 && <span className="notif-bell-badge">{badge}</span>}
    </button>
  );
}
