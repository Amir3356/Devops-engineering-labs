import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { getProductsApi } from '../../api/product.api';
import orderService from '../../services/order.service';
import ProductDiscoverySidebar from './ProductDiscoverySidebar';
import OrderHistory from '../orders/OrderHistory';

import {
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  Package,
  Check,
  Loader2,
  ChevronDown,
  Search,
  Filter
} from 'lucide-react';

/**
 * CustomerDashboard
 * RBAC Protected Workspace for Customers.
 * Displays live microservices data: products, orders.
 * Matches the Admin RBAC Portal UI, layout, and visual design.
 */
export default function CustomerDashboard() {
  const { user } = useAuth();
  const { addToCart, openCart, cartCount } = useCart();

  // State initialized purely from live data
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('discovery'); // 'discovery' | 'orders'
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Added-to-cart alert state
  const [addedItemName, setAddedItemName] = useState('');
  const [addedProductId, setAddedProductId] = useState(null);
  const [orders, setOrders] = useState([]);

  // Fetch live products & customer orders
  useEffect(() => {
    Promise.allSettled([
      getProductsApi(),
      orderService.fetchOrders()
    ]).then(([prodRes, ordsRes]) => {
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
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

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

  // Unique categories for filter dropdown
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  // Filtered products based on search and category
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'All' || prod.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query ||
      (prod.name && prod.name.toLowerCase().includes(query)) ||
      (prod.category && prod.category.toLowerCase().includes(query)) ||
      (prod.description && prod.description.toLowerCase().includes(query));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="admin-portal-layout">
      {/* Customer Sidebar Navigation matching Admin Sidebar */}
      <ProductDiscoverySidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        productsCount={products.length}
        ordersCount={orders.length}
      />

      <div className="admin-workspace">
        {/* Topbar matching Admin Portal */}
        <header className="admin-topbar">
          <div className="topbar-user-chip">
            <span className="topbar-avatar">{(user?.name || 'C').charAt(0).toUpperCase()}</span>
            <span className="topbar-user-text">
              <span className="topbar-user-name">{user?.name || 'Customer'}</span>
              <span className="topbar-user-role">{user?.role || 'customer'} (RBAC Active)</span>
            </span>
            <ChevronDown size={16} />
          </div>
        </header>

        {/* Main Workspace Panel */}
        <main className="admin-main-panel">
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

          {/* TAB 1: EXPLORE PRODUCTS */}
          {activeTab === 'discovery' && (
            <div className="admin-view-content">
              {/* Header */}
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Product Catalog &amp; Discovery</h2>
                  <p className="admin-view-sub">
                    Browse catalog products, pricing, and live availability via <strong>Product Service</strong> (Port 5002).
                  </p>
                </div>
              </div>

              {/* Search & Category Filter Card matching Admin style */}
              <div className="admin-filter-card">
                <div className="admin-search-field">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search products by title, SKU, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="admin-filter-row">
                  <Filter size={16} className="admin-filter-icon" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'All' ? 'All Categories' : cat}
                      </option>
                    ))}
                  </select>
                  <span className="admin-filter-total">
                    Total: <strong>{filteredProducts.length}</strong> products
                  </span>
                </div>
              </div>

              {/* Product Cards Grid or Loading / Empty state */}
              {isLoading ? (
                <div className="discovery-loading-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <Loader2 size={36} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted, #94a3b8)' }}>Loading catalog from Product Service...</p>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="discovery-product-grid">
                  {filteredProducts.map((prod) => {
                    const isLowStock = prod.stock > 0 && prod.stock <= 5;
                    const isOutOfStock = prod.stock <= 0;

                    return (
                      <div key={prod.id} className="product-card">
                        <div className="product-card-image-wrap">
                          <img
                            src={prod.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'}
                            alt={prod.name}
                            className="product-card-img"
                          />
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
                  <h3>No products found</h3>
                  <p>There are currently no products matching your criteria.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY ORDERS */}
          {activeTab === 'orders' && (
            <div className="admin-view-content">
              <OrderHistory />
            </div>
          )}
        </main>
      </div>

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
