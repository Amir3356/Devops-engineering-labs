import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useEvents } from '../../context/EventContext';
import { getProductsApi } from '../../api/product.api';
import { getNotificationsApi, markNotificationAsReadApi } from '../../api/notification.api';
import { getPaymentHistoryApi } from '../../api/payment.api';
import orderService from '../../services/order.service';
import { INITIAL_PRODUCTS } from '../products/HomeCatalog';
import ProductDiscoverySidebar from './ProductDiscoverySidebar';
import OrderHistory from '../orders/OrderHistory';
import CustomerNotifications from '../notifications/CustomerNotifications';
import CustomerPayments from '../payments/CustomerPayments';

export const INITIAL_PAYMENTS = [
  {
    id: 'pay-txn-88192',
    paymentId: 'pay-txn-88192',
    orderId: 'ORD-2026-9041',
    amount: 199.99,
    currency: 'USD',
    paymentMethod: 'Online Payment',
    status: 'Success',
    transactionRef: 'TXN-9041-SETTLED',
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'pay-txn-77341',
    paymentId: 'pay-txn-77341',
    orderId: 'ORD-2026-8712',
    amount: 89.50,
    currency: 'USD',
    paymentMethod: 'Online Payment',
    status: 'Success',
    transactionRef: 'TXN-8712-VERIFIED',
    createdAt: new Date(Date.now() - 259200000).toISOString()
  }
];
import {
  Compass,
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  Package,
  Star,
  Check
} from 'lucide-react';

/**
 * CustomerDashboard
 * RBAC Protected Workspace for Customers.
 * Featuring the Product Discovery Sidebar, product catalog,
 * and integrated order management.
 */
export default function CustomerDashboard() {
  const { user } = useAuth();
  const { addToCart, openCart, cartCount } = useCart();
  const { addLocalEvent } = useEvents();

  // State
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [activeTab, setActiveTab] = useState('discovery'); // 'discovery' | 'orders' | 'payments' | 'notifications'

  // Added-to-cart alert state
  const [addedItemName, setAddedItemName] = useState('');
  const [addedProductId, setAddedProductId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-welcome-01',
      title: 'Welcome to Citizen Portal',
      message: 'Your citizen identity and RBAC profile are successfully verified.',
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'notif-welcome-02',
      title: 'Catalog Updates Available',
      message: 'New electronic products and certified gadgets have arrived in the catalog.',
      type: 'info',
      isRead: false,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ]);

  // Fetch live products, customer orders & notifications
  useEffect(() => {
    getProductsApi()
      .then((res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setProducts(res.data);
        }
      })
      .catch(() => {
        // Graceful fallback to initial products
      });

    orderService.fetchOrders().then((ords) => {
      if (ords && ords.length > 0) setOrders(ords);
    });

    getNotificationsApi()
      .then((res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setNotifications(res.data);
        }
      })
      .catch(() => {});

    getPaymentHistoryApi()
      .then((res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setPayments(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleMarkNotificationRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationAsReadApi(id);
    } catch {}
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

    // Open Cart Drawer so the customer immediately sees their cart
    openCart();

    // Emit CartItemAdded Event
    addLocalEvent('CartItemAdded', 'cart-service', {
      customerId: user?.id,
      productId: prod.id,
      name: prod.name,
      price: prod.price
    });
  };

  return (
    <div className="customer-portal-layout">
      {/* Product Discovery Sidebar */}
      <ProductDiscoverySidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ordersCount={orders.length}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Main Workspace Area */}
      <main className="customer-main-panel">
        {/* Added-to-Cart Toast Alert */}
        {addedItemName && (
          <div className="cart-toast-alert">
            <div className="cart-toast-msg">
              <CheckCircle size={18} className="text-emerald" />
              <span>Added <strong>{addedItemName}</strong> to your shopping cart!</span>
            </div>
            <button
              type="button"
              className="btn-toast-view-cart"
              onClick={openCart}
            >
              Pay →
            </button>
          </div>
        )}

        {/* TAB 1: PRODUCT DISCOVERY */}
        {activeTab === 'discovery' && (
          <div className="customer-discovery-view">
            {/* Products Toolbar */}
            <div className="discovery-results-toolbar">
              <div className="discovery-toolbar-left">
                <h2 className="discovery-results-title">
                  Available Products
                </h2>
                <span className="discovery-results-count">
                  {products.length} {products.length === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {/* Product Cards Grid */}
            {products.length > 0 ? (
              <div className="discovery-product-grid">
                {products.map((prod) => {
                  const isLowStock = prod.stock > 0 && prod.stock <= 5;
                  const isOutOfStock = prod.stock <= 0;

                  return (
                    <div key={prod.id} className="product-card">
                      <div className="product-card-image-wrap">
                        <img src={prod.image} alt={prod.name} className="product-card-img" />
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
                          ★ {prod.rating || 4.8}
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
