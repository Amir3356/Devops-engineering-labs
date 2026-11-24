import { useEffect } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AbilityProvider } from './context/AbilityContext';
import { CartProvider, useCart } from './context/CartContext';
import { EventProvider } from './context/EventContext';
import Navbar from './components/Navbar';
import EventStreamDrawer from './components/EventStreamDrawer';
import { AppRoutes } from './routes';
import { CartDrawer } from './features/cart';
import './App.css';

function MainApp() {
  const { user, isAdmin } = useAuth();
  const { isCartOpen, closeCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();


  const isCustomerDashboard = location.pathname.startsWith('/dashboard');
  const isAdminPortal = location.pathname.startsWith('/admin');
  const isAuthPage = location.pathname === '/';
  // Sidebar portals and the split-panel auth page render full-bleed without the top navbar/footer
  const isFullBleed = isCustomerDashboard || isAdminPortal || isAuthPage;

  // Auto-redirect if role changes
  useEffect(() => {
    if (isAdmin && location.pathname === '/') {
      navigate('/admin/dashboard');
    } else if (!isAdmin && location.pathname.startsWith('/admin')) {
      navigate('/');
    }
  }, [isAdmin, location.pathname, navigate]);

  return (
    <div className="app-shell">
      {/* Top Header Navigation - Excluded on Customer RBAC Dashboard */}
      {!isFullBleed && <Navbar />}

      {/* Main Viewport via React Router */}
      <main className={`main-viewport ${isCustomerDashboard || isAdminPortal ? 'dashboard-viewport' : ''} ${isAuthPage ? 'auth-viewport' : ''}`}>
        <AppRoutes />
      </main>

      {/* Footer */}
      {!isFullBleed && (
      <footer className="platform-footer">
        <div className="footer-inner">
          <div className="footer-left">
            <span className="footer-brand">NexusCommerce</span>
            <span className="footer-tagline">Microservices Architecture & Event-Driven Demonstration</span>
          </div>
          <div className="footer-right">
            <span>Actor Context: <strong>{user ? `${user.name} (${user.role})` : 'Guest Visitor'}</strong></span>
            <span className="footer-sep">•</span>
            <span>Local Node.js EventEmitter Bus Active</span>
          </div>
        </div>
      </footer>
      )}

      {/* Modals and Drawers */}
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />

      {/* Real-time Event Console Drawer */}
      <EventStreamDrawer />

      {/* Global Sonner Toast Notifications (Auto-dismiss in 4 seconds) */}
      <Toaster position="top-right" duration={4000} richColors closeButton />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <EventProvider>
        <AuthProvider>
          <AbilityProvider>
            <CartProvider>
              <MainApp />
            </CartProvider>
          </AbilityProvider>
        </AuthProvider>
      </EventProvider>
    </BrowserRouter>
  );
}
