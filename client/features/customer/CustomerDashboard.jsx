import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { getProductsApi, getCategoriesApi } from '../../api/product.api';
import { getAllStockApi } from '../../api/inventory.api';
import orderService from '../../services/order.service';
import { subscribeRealtime } from '../../services/realtime.service';
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
  const navigate = useNavigate();
  const { addToCart, openCart, cartCount } = useCart();

  // State initialized purely from live data
  const [products, setProducts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState(['All']);
  const [activeTab, setActiveTab] = useState('discovery'); // 'discovery' | 'orders'
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Added-to-cart alert state
  const [addedItemName, setAddedItemName] = useState('');
  const [addedProductId, setAddedProductId] = useState(null);
  const [orders, setOrders] = useState([]);

  // Fetch live products, inventory stock, & customer orders.
  // Only products the admin has stocked (inventory row with stock > 0) are shown.
  // The gateway pushes "catalog.updated" over WebSocket after any product/stock change,
  // so newly stocked products appear immediately — no polling.
  useEffect(() => {
    let cancelled = false;

    const loadCatalog = (isFirstLoad = false) => {
    if (isFirstLoad) setIsLoading(true);
    return Promise.allSettled([
      getProductsApi(),
      getCategoriesApi(),
      getAllStockApi(),
      orderService.fetchOrders()
    ]).then(([prodRes, catRes, stockRes, ordsRes]) => {
      if (cancelled) return;
      const stockMap = {};
      if (stockRes.status === 'fulfilled' && stockRes.value?.success && Array.isArray(stockRes.value.data)) {
        stockRes.value.data.forEach((item) => {
          stockMap[item.productId || item.product_id] = {
            quantity: Number(item.stockQuantity ?? item.stock_quantity ?? item.stock) || 0,
            // Selling price is set by the admin in Inventory → Add Stock (null until then)
            unitSellingPrice: item.unitSellingPrice == null ? null : Number(item.unitSellingPrice)
          };
        });
      }

      if (prodRes.status === 'fulfilled') {
        const rawProducts = Array.isArray(prodRes.value?.data)
          ? prodRes.value.data
          : Array.isArray(prodRes.value)
          ? prodRes.value
          : [];

        // Visible only once stock has been added in Admin → Inventory → Add Stock
        const stocked = rawProducts
          .filter((prod) => stockMap[prod.id]?.quantity > 0)
          .map((prod) => ({
            ...prod,
            stock: stockMap[prod.id].quantity,
            // The price customers pay (and the cart uses) is the inventory unit selling price
            price: stockMap[prod.id].unitSellingPrice,
            hasPrice: stockMap[prod.id].unitSellingPrice !== null
          }));
        setProducts(stocked);
      } else {
        setProducts([]);
      }

      if (catRes.status === 'fulfilled' && catRes.value?.success && Array.isArray(catRes.value.data)) {
        const catNames = catRes.value.data.map((c) => c.name).filter(Boolean);
        if (catNames.length > 0) {
          setAvailableCategories(['All', ...Array.from(new Set(catNames))]);
        }
      }

      if (ordsRes.status === 'fulfilled' && Array.isArray(ordsRes.value)) {
        setOrders(ordsRes.value);
      } else {
        setOrders([]);
      }
    }).finally(() => {
      if (!cancelled && isFirstLoad) setIsLoading(false);
    });
    };

    loadCatalog(true);

    // Several writes often arrive together (e.g. stock + purchase); reload once per burst.
    let reloadTimer = null;
    const scheduleReload = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => loadCatalog(false), 300);
    };
    let hasConnectedBefore = false;
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === 'catalog.updated') scheduleReload();
      // After a reconnect, resync anything missed while offline
      if (event.type === 'connection.open') {
        if (hasConnectedBefore) scheduleReload();
        hasConnectedBefore = true;
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, []);

  const handleAddToCart = (prod) => {
    addToCart(prod);
    toast.success(`${prod.name} added to cart!`, {
      action: {
        label: 'View Cart',
        onClick: () => openCart()
      }
    });
    openCart();
  };

  // Unique categories for filter dropdown
  const categories = Array.from(new Set([...availableCategories, ...products.map((p) => p.category).filter(Boolean)]));

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                title="Return to Admin RBAC Portal"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                ← Return to Admin Portal
              </button>
            )}
          </div>
          <div className="topbar-user-chip">
            <span className="topbar-avatar">{(user?.name || 'C').charAt(0).toUpperCase()}</span>
            <span className="topbar-user-text">
              <span className="topbar-user-name">{user?.name || 'Customer'}</span>
              <span className="topbar-user-role">{user?.role || 'customer'}</span>
            </span>
            <ChevronDown size={16} />
          </div>
        </header>

        {/* Main Workspace Panel */}
        <main className="admin-main-panel">
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
                    const canBuy = !isOutOfStock && prod.hasPrice;

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
                          <h3 className="product-card-title" title={prod.name}>
                            {prod.name}
                          </h3>
                          <p className="product-card-desc">
                            {prod.description}
                          </p>
                          <p className={`product-card-stock ${isLowStock ? 'low' : ''}`}>
                            <Package size={14} />
                            <span>
                              <strong>{prod.stock}</strong> {prod.stock === 1 ? 'unit' : 'units'} left
                            </span>
                          </p>

                          <div className="product-card-footer">
                            {prod.hasPrice ? (
                              <div className="product-price">
                                <span className="currency">$</span>
                                <span className="amount">{Number(prod.price).toFixed(2)}</span>
                              </div>
                            ) : (
                              <div className="product-price product-price-unset">Price not set</div>
                            )}

                            <div className="product-card-actions">
                              <button
                                type="button"
                                className={`btn-add-cart ${addedProductId === prod.id ? 'btn-added-success' : ''}`}
                                onClick={() => handleAddToCart(prod)}
                                disabled={!canBuy}
                                title={prod.hasPrice ? 'Add to Cart' : 'This product has no selling price yet'}
                              >
                                {addedProductId === prod.id ? (
                                  <>
                                    <Check size={16} />
                                    <span>Added to Cart!</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingCart size={16} />
                                    <span>{isOutOfStock ? 'Sold Out' : prod.hasPrice ? 'Add to Cart' : 'Unavailable'}</span>
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
                  {products.length === 0 ? (
                    <>
                      <h3>No products available yet</h3>
                      <p>New products appear here as soon as they are in stock.</p>
                    </>
                  ) : (
                    <>
                      <h3>No products found</h3>
                      <p>There are currently no products matching your criteria.</p>
                    </>
                  )}
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

      {/* Floating Cart Button when items in cart (hidden on the My Orders tab) */}
      {cartCount > 0 && activeTab !== 'orders' && (
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
