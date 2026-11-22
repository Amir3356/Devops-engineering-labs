import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useEvents } from '../context/EventContext';
import { Can } from '../context/AbilityContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Zap, User, LogOut, ShieldCheck, ShoppingCart, ListOrdered, LayoutDashboard } from 'lucide-react';

export default function Navbar({ onOpenAuth, onOpenCart }) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { cartCount } = useCart();
  const { unreadCount, openDrawer, events } = useEvents();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Brand Logo */}
        <div className="brand-logo" onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/')}>
          <div className="logo-icon-wrap">
            <ShoppingBag className="brand-icon" size={24} />
          </div>
          <div className="brand-text">
            <span className="brand-title">NexusCommerce</span>
            <span className="brand-subtitle">Microservices • EDA</span>
          </div>
        </div>

        {/* Navigation Links with CASL RBAC Guards */}
        <nav className="nav-links">
          <button
            className={`nav-btn ${currentPath === '/' || currentPath === '/catalog' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            Catalog
          </button>

          <Can I="read" a="Order">
            <button
              className={`nav-btn ${currentPath === '/orders' ? 'active' : ''}`}
              onClick={() => navigate('/orders')}
            >
              <ListOrdered size={16} />
              My Orders
            </button>
          </Can>

          <Can I="manage" a="Profile">
            <button
              className={`nav-btn ${currentPath === '/profile' ? 'active' : ''}`}
              onClick={() => navigate('/profile')}
            >
              <User size={16} />
              Profile
            </button>
          </Can>

          <Can I="manage" a="AdminDashboard">
            <button
              className={`nav-btn ${currentPath.startsWith('/admin') ? 'active' : ''}`}
              onClick={() => navigate('/admin/dashboard')}
            >
              <LayoutDashboard size={16} />
              Admin Dashboard
            </button>
          </Can>
        </nav>

        {/* Action Controls */}
        <div className="nav-actions">
          {/* Live Event Stream Button */}
          <button
            className="event-stream-trigger"
            onClick={openDrawer}
            title="Open Live EventEmitter Console"
          >
            <Zap size={17} className="pulse-icon" />
            <span className="event-stream-label">Event Hub</span>
            <span className="event-badge">{events.length}</span>
            {unreadCount > 0 && <span className="event-unread-dot" />}
          </button>

          {/* Customer Shopping Cart (Guarded by CASL Ability) */}
          <Can I="manage" a="Cart">
            <button className="cart-trigger-btn" onClick={onOpenCart} title="View Shopping Cart">
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
          </Can>

          {/* Authentication Section */}
          {isAuthenticated ? (
            <div className="user-profile-widget">
              <div className="user-identity">
                <span className="user-name">{user.name || user.phone}</span>
                <span className={`user-role-tag ${user.role}`}>
                  {user.role === 'admin' ? <ShieldCheck size={12} /> : null}
                  {user.role}
                </span>
              </div>
              <button className="logout-btn" onClick={logout} title="Log Out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="login-modal-btn" onClick={onOpenAuth}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
