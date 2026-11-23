import { useState } from 'react';
import {
  CheckCircle,
  Package,
  AlertTriangle,
  Info,
  ShieldCheck,
  Check,
  CheckCheck,
  Clock,
  Inbox
} from 'lucide-react';

/**
 * CustomerNotifications
 * Citizen / Customer Notifications workspace component.
 * Displays incoming alerts, order updates, system messages, and read status management.
 */
export default function CustomerNotifications({
  notifications = [],
  onMarkRead,
  onMarkAllRead
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredList = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order':
        return (
          <div className="notif-icon-wrap notif-order">
            <Package size={18} />
          </div>
        );
      case 'alert':
      case 'warning':
        return (
          <div className="notif-icon-wrap notif-alert">
            <AlertTriangle size={18} />
          </div>
        );
      case 'security':
        return (
          <div className="notif-icon-wrap notif-security">
            <ShieldCheck size={18} />
          </div>
        );
      case 'system':
      case 'success':
        return (
          <div className="notif-icon-wrap notif-success">
            <CheckCircle size={18} />
          </div>
        );
      default:
        return (
          <div className="notif-icon-wrap notif-info">
            <Info size={18} />
          </div>
        );
    }
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return 'Recently';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="customer-notifications-view">
      {/* Notifications Header Row */}
      <div className="notif-toolbar-header">
        <div>
          <h2 className="notif-view-title">Notifications & Alerts</h2>
          <p className="notif-view-sub">
            Updates regarding your orders, citizen account activity, and system notices.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="btn-mark-all-read"
            onClick={onMarkAllRead}
            title="Mark all notifications as read"
          >
            <CheckCheck size={16} /> Mark All as Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="notif-filter-pills">
        <button
          type="button"
          className={`notif-filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          type="button"
          className={`notif-filter-pill ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread {unreadCount > 0 && <span className="notif-pill-badge">{unreadCount}</span>}
        </button>
      </div>

      {/* Notifications List */}
      {filteredList.length > 0 ? (
        <div className="notif-cards-list">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className={`notif-card ${!item.isRead ? 'unread' : 'read'}`}
            >
              <div className="notif-card-left">
                {getNotificationIcon(item.type)}
                {!item.isRead && <span className="notif-unread-dot" title="Unread" />}
              </div>

              <div className="notif-card-body">
                <div className="notif-card-header">
                  <h4 className="notif-card-title">{item.title}</h4>
                  <span className="notif-card-time">
                    <Clock size={12} /> {formatTimestamp(item.createdAt)}
                  </span>
                </div>
                <p className="notif-card-msg">{item.message}</p>
              </div>

              {!item.isRead && (
                <div className="notif-card-actions">
                  <button
                    type="button"
                    className="btn-mark-single-read"
                    onClick={() => onMarkRead(item.id)}
                    title="Mark as read"
                  >
                    <Check size={14} /> Mark Read
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="notif-empty-state">
          <div className="empty-icon-circle">
            <Inbox size={36} />
          </div>
          <h3>No notifications found</h3>
          <p>
            {filter === 'unread'
              ? 'You have caught up with all your notifications!'
              : 'You do not have any notifications at the moment.'}
          </p>
        </div>
      )}
    </div>
  );
}
