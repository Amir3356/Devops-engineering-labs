import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  Package,
  Bell,
  CreditCard,
  LogOut,
  ShoppingBag
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
      {/* Brand & Sidebar Title */}
      <div className="discovery-sidebar-header">
        <div className="discovery-brand-row">
          <ShoppingBag size={22} className="text-primary" />
          <span className="discovery-brand-name">NexusCommerce</span>
        </div>
        <div className="discovery-header-title">
          <div className="discovery-icon-wrapper">
            <Compass size={20} className="text-primary" />
          </div>
          <div>
            <h3>Product Discovery</h3>
            <span className="discovery-header-subtitle">Customer Portal</span>
          </div>
        </div>
      </div>

      {/* Customer Identity Badge */}
      {user && (
        <div className="discovery-user-card">
          <div className="discovery-user-info">
            <span className="discovery-user-name">{user.name || 'Valued Customer'}</span>
            <span className="discovery-user-phone">
              {user.email || user.phone}
            </span>
          </div>
          <span className="user-role-tag customer">
            {user.role}
          </span>
        </div>
      )}

      {/* Main Customer Workspace Tabs */}
      <div className="discovery-section-nav">
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

        <button
          className={`discovery-nav-tab ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <CreditCard size={17} />
          <span>My Payment</span>
        </button>

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

      {/* Sidebar Footer: Sign Out Action */}
      <div className="discovery-sidebar-footer">
        <button
          type="button"
          className="discovery-logout-btn"
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
