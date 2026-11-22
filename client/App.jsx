import React, { useState } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AbilityProvider } from './context/AbilityContext';
import { CartProvider } from './context/CartContext';
import { EventProvider } from './context/EventContext';
import Navbar from './components/Navbar';
import EventStreamDrawer from './components/EventStreamDrawer';
import { AppRoutes } from './routes';
import { AuthModal } from './features/auth';
import { CartDrawer, CheckoutModal } from './features/cart';
import { ProductDetailModal } from './features/products';
import './App.css';

function MainApp() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Auto-redirect if role changes
  React.useEffect(() => {
    if (isAdmin && !location.pathname.startsWith('/admin')) {
      navigate('/admin/dashboard');
    } else if (!isAdmin && location.pathname.startsWith('/admin')) {
      navigate('/');
    }
  }, [isAdmin, location.pathname, navigate]);

  return (
    <div className="app-shell">
      {/* Top Navigation */}
      <Navbar
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Main Viewport via React Router */}
      <main className="main-viewport">
        <AppRoutes onSelectProduct={(prod) => setSelectedProduct(prod)} />
      </main>

      {/* Footer */}
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

      {/* Modals and Drawers */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderCompleted={() => {
          navigate('/orders');
        }}
      />

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Real-time Event Console Drawer */}
      <EventStreamDrawer />
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
