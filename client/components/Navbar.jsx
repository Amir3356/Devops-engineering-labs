import { useAuth } from '../context/AuthContext';
import { Can } from '../context/AbilityContext';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { ShoppingBag, User, LogOut, ShieldCheck, ListOrdered, LayoutDashboard, Compass } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
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
          <Can I="read" a="Order">
            <button
              className={`nav-btn ${currentPath === '/orders' ? 'active' : ''}`}
              onClick={() => navigate('/orders')}
            >
              <ListOrdered size={16} />
              My Orders
            </button>
          </Can>

          <Can I="read" a="Notification">
            <NotificationBell
              active={currentPath === '/notifications'}
              onClick={() => navigate('/notifications')}
            />
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

          <Can I="read" a="CustomerDashboard">
            <button
              className={`nav-btn ${currentPath.startsWith('/dashboard') ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              <Compass size={16} />
              Customer Dashboard
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
        {isAuthenticated && (
          <div className="nav-actions">
            <div className="user-profile-widget">
              <div className="user-identity">
                <span className="user-name">{user.name || user.email || user.phone}</span>
                <span className={`user-role-tag ${user.role}`}>
                  {user.role === 'admin' ? <ShieldCheck size={12} /> : null}
                  {user.role}
                </span>
              </div>
              <button className="logout-btn" onClick={logout} title="Log Out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
