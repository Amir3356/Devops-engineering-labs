import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  Package,
  Bell,
  LogOut,
  ShoppingBag,
  User
} from 'lucide-react';

/**
 * ProductDiscoverySidebar component
 * RBAC Customer Dashboard sidebar providing customer identity,
 * primary workspace navigation, notifications, and session logout.
 */
export default function ProductDiscoverySidebar({
  activeTab,
  setActiveTab,
  ordersCount = 0,
  unreadNotificationsCount = 0
}) {
  const { user, logout } = useAuth();

  return (
    <aside className="discovery-sidebar">
      {/* Brand */}
      <div className="side-brand">
        <div className="side-brand-icon"><ShoppingBag size={20} /></div>
        <div className="side-brand-text">
          <span className="side-brand-name">NexusCommerce</span>
          <span className="side-brand-sub">Customer Portal</span>
        </div>
      </div>

      {/* Main Customer Workspace Tabs */}
      <div className="discovery-section-nav">
        <span className="side-section-label">Shopping</span>
        <button
          className={`discovery-nav-tab ${activeTab === 'discovery' ? 'active' : ''}`}
          onClick={() => setActiveTab('discovery')}
        >
          <Compass size={17} />
          <span>Explore Products</span>
        </button>

        <button
          className={`discovery-nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <Package size={17} />
          <span>My Orders</span>
          {ordersCount > 0 && <span className="discovery-tab-badge highlight">{ordersCount}</span>}
        </button>

        <span className="side-section-label">Account</span>
        <button
          className={`discovery-nav-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={17} />
          <span>Notifications</span>
          {unreadNotificationsCount > 0 && (
            <span className="discovery-tab-badge unread-badge">{unreadNotificationsCount}</span>
          )}
        </button>
      </div>

      {/* Sidebar Footer: Identity + Sign Out */}
      <div className="side-footer">
        {user && (
          <div className="side-user-card">
            <div className="side-user-avatar"><User size={18} /></div>
            <div className="side-user-info">
              <span className="side-user-name">{user.name || 'Valued Customer'}</span>
              <span className="side-user-role">{user.role}</span>
              <span className="side-user-contact">{user.email || user.phone}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          className="side-signout-btn"
          onClick={logout}
          title="Sign out of your session"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
