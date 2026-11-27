import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import {
  Compass,
  ShoppingCart,
  LogOut,
  ShoppingBag,
  User
} from 'lucide-react';

/**
 * ProductDiscoverySidebar component
 * RBAC Customer Dashboard sidebar matching the Admin Portal sidebar UI & layout.
 */
export default function ProductDiscoverySidebar({
  activeTab,
  setActiveTab,
  productsCount = 0,
  ordersCount = 0
}) {
  const { user, logout } = useAuth();

  return (
    <aside className="admin-sidebar">
      {/* Brand Header */}
      <div className="side-brand">
        <div className="side-brand-icon">
          <ShoppingBag size={20} />
        </div>
        <div className="side-brand-text">
          <span className="side-brand-name">NexusCommerce</span>
          <span className="side-brand-sub">Customer RBAC Portal</span>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <nav className="admin-nav-menu">
        <span className="side-section-label">Catalog Management</span>
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'discovery' ? 'active' : ''}`}
          onClick={() => setActiveTab('discovery')}
        >
          <Compass size={18} />
          <span>Explore Products</span>
          <span className="admin-nav-count">{productsCount}</span>
        </button>

        <span className="side-section-label">Sales &amp; Fulfillment</span>
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingCart size={18} />
          <span>My Orders</span>
          <span className="admin-nav-count">{ordersCount}</span>
        </button>

        <NotificationBell
          variant="sidebar"
          active={activeTab === 'notifications'}
          onClick={() => setActiveTab('notifications')}
        />
      </nav>

      {/* Sidebar Footer: Identity + Sign Out */}
      <div className="side-footer">
        <div className="side-user-card">
          <div className="side-user-avatar">
            <User size={18} />
          </div>
          <div className="side-user-info">
            <span className="side-user-name">{user?.name || 'Customer'}</span>
            <span className="side-user-role">{user?.role || 'customer'}</span>
            <span className="side-user-contact">{user?.email || user?.phone}</span>
          </div>
        </div>
        <button
          type="button"
          className="side-signout-btn"
          onClick={logout}
          title="Sign out of your session"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
