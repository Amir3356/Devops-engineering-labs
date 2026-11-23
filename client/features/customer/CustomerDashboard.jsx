import { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { getProductsApi } from '../../api/product.api';
import { getNotificationsApi, markNotificationAsReadApi } from '../../api/notification.api';
import { getPaymentHistoryApi } from '../../api/payment.api';
import orderService from '../../services/order.service';
import ProductDiscoverySidebar from './ProductDiscoverySidebar';
import OrderHistory from '../orders/OrderHistory';
import CustomerNotifications from '../notifications/CustomerNotifications';
import CustomerPayments from '../payments/CustomerPayments';

import {
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  Package,
  Check,
  Loader2
} from 'lucide-react';

/**
 * CustomerDashboard
 * RBAC Protected Workspace for Customers.
 * Displays live microservices data: products, orders, payments, notifications.
 */
export default function CustomerDashboard() {
  const { addToCart, openCart, cartCount } = useCart();

  // State initialized purely from live data
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('discovery'); // 'discovery' | 'orders' | 'payments' | 'notifications'
  const [isLoading, setIsLoading] = useState(true);

  // Added-to-cart alert state
  const [addedItemName, setAddedItemName] = useState('');
  const [addedProductId, setAddedProductId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Fetch live products, customer orders & notifications
  useEffect(() => {
    Promise.allSettled([
      getProductsApi(),
      orderService.fetchOrders(),
      getNotificationsApi(),
      getPaymentHistoryApi()
    ]).then(([prodRes, ordsRes, notifRes, payRes]) => {
      if (prodRes.status === 'fulfilled' && prodRes.value?.success && Array.isArray(prodRes.value.data)) {
        setProducts(prodRes.value.data);
      } else {
        setProducts([]);
      }

      if (ordsRes.status === 'fulfilled' && Array.isArray(ordsRes.value)) {
        setOrders(ordsRes.value);
      } else {
        setOrders([]);
      }

      if (notifRes.status === 'fulfilled' && notifRes.value?.success && Array.isArray(notifRes.value.data)) {
        setNotifications(notifRes.value.data);
      } else {
        setNotifications([]);
      }

      if (payRes.status === 'fulfilled' && payRes.value?.success && Array.isArray(payRes.value.data)) {
        setPayments(payRes.value.data);
      } else {
        setPayments([]);
      }
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const handleMarkNotificationRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationAsReadApi(id);
    } catch {
      // Ignored
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    for (const item of unread) {
      markNotificationAsReadApi(item.id).catch(() => {});
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const handleAddToCart = (prod) => {
    addToCart(prod);
    setAddedItemName(prod.name);
    setAddedProductId(prod.id);
    setTimeout(() => {
      setAddedItemName('');
      setAddedProductId(null);
    }, 2500);

    // Open Cart Drawer so the customer immediately sees their updated cart
    openCart();
  };

  return (
    <div className="discovery-layout">
      {/* Product Discovery Sidebar */}
      <ProductDiscoverySidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ordersCount={orders.length}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Main Workspace Area */}
      <main className="discovery-main">
        {/* Added to Cart Toast Notification */}
        {addedItemName && (
          <div className="added-to-cart-toast" role="status" aria-live="polite">
            <CheckCircle size={18} className="toast-icon" />
            <div className="toast-message">
              <strong>{addedItemName}</strong> added to cart!
            </div>
            <button
              type="button"
              className="toast-action-btn"
              onClick={openCart}
            >
              View Cart ({cartCount})
            </button>
          </div>
        )}

        {/* TAB 1: PRODUCT DISCOVERY */}
        {activeTab === 'discovery' && (
          <div className="discovery-content">
            {/* Header */}
            <div className="discovery-header">
              <div className="discovery-header-top">
                <h2 className="discovery-title">
                  All Catalog Products
                </h2>
                <span className="discovery-results-count">
                  {products.length} {products.length === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {/* Product Cards Grid or Loading / Empty state */}
            {isLoading ? (
              <div className="discovery-loading-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Loader2 size={36} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-muted, #94a3b8)' }}>Loading catalog from Product Service...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="discovery-product-grid">
                {products.map((prod) => {
                  const isLowStock = prod.stock > 0 && prod.stock <= 5;
                  const isOutOfStock = prod.stock <= 0;

                  return (
                    <div key={prod.id} className="product-card">
                      <div className="product-card-image-wrap">
                        <img src={prod.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'} alt={prod.name} className="product-card-img" />
                        <span className="product-card-category">{prod.category}</span>
                        {isLowStock && (
                          <span className="product-badge-low-stock">
                            <AlertTriangle size={12} /> Only {prod.stock} left
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="product-badge-out-stock">Out of Stock</span>
                        )}
                      </div>

                      <div className="product-card-details">
                        <div className="product-card-rating">
                          ★ {prod.rating || '5.0'}
                        </div>
                        <h3 className="product-card-title" title={prod.name}>
                          {prod.name}
                        </h3>
                        <p className="product-card-desc">
                          {prod.description}
                        </p>

                        <div className="product-card-footer">
                          <div className="product-price">
                            <span className="currency">$</span>
                            <span className="amount">{Number(prod.price).toFixed(2)}</span>
                          </div>

                          <div className="product-card-actions">
                            <button
                              type="button"
                              className={`btn-add-cart ${addedProductId === prod.id ? 'btn-added-success' : ''}`}
                              onClick={() => handleAddToCart(prod)}
                              disabled={isOutOfStock}
                              title="Add to Cart"
                            >
                              {addedProductId === prod.id ? (
                                <>
                                  <Check size={16} />
                                  <span>Added to Cart!</span>
                                </>
                              ) : (
                                <>
                                  <ShoppingCart size={16} />
                                  <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="discovery-empty-state">
                <div className="empty-icon-circle">
                  <Package size={36} />
                </div>
                <h3>No products available</h3>
                <p>There are currently no products available in the catalog.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY ORDERS */}
        {activeTab === 'orders' && (
          <div className="customer-embedded-view">
            <OrderHistory />
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="customer-embedded-view">
            <CustomerNotifications
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
            />
          </div>
        )}

        {/* TAB 4: MY PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="customer-embedded-view">
            <CustomerPayments payments={payments} />
          </div>
        )}
      </main>

      {/* Floating Cart Button when items in cart */}
      {cartCount > 0 && (
        <button
          type="button"
          className="floating-cart-pill"
          onClick={openCart}
          title="Open Shopping Cart"
        >
          <ShoppingCart size={18} />
          <span>Cart ({cartCount})</span>
        </button>
      )}
    </div>
  );
}
