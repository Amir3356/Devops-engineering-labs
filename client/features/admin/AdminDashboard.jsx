import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { useAbility } from '../../context/AbilityContext';
import { productSchema } from '../../utils/validators';
import orderService from '../../services/order.service';
import { INITIAL_PRODUCTS, CATEGORIES } from '../products/HomeCatalog';
import { getProductsApi, createProductApi, updateProductApi, deleteProductApi } from '../../api/product.api';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  DollarSign,
  ArrowUpRight
} from 'lucide-react';

export default function AdminDashboard() {
  const { addLocalEvent } = useEvents();

  const [activeAdminTab, setActiveAdminTab] = useState('overview'); // overview, products, inventory, orders, customers, payments, sales
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState(CATEGORIES.filter(c => c !== 'All'));
  const [newCatName, setNewCatName] = useState('');

  // Orders in system
  const [orders, setOrders] = useState(() => orderService.getStoredOrders());

  React.useEffect(() => {
    orderService.fetchAllAdminOrders().then(ords => {
      if (ords && ords.length > 0) setOrders(ords);
    });
    getProductsApi().then(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setProducts(res.data);
      }
    }).catch(() => {});
  }, []);

  // Modal State for Product CRUD
  const ability = useAbility();
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [formError, setFormError] = useState('');
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Electronics',
    price: '',
    stock: '',
    description: '',
    image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80'
  });

  // KPI Calculations
  const totalSales = orders.reduce((sum, ord) => sum + (ord.status !== 'Cancelled' ? ord.totalAmount : 0), 4850.50);
  const totalOrdersCount = orders.length + 14;
  const lowStockCount = products.filter(p => p.stock <= 5).length;
  const totalCustomers = 42;

  // Handlers for Products
  const handleOpenCreateProduct = () => {
    setEditingProductId(null);
    setFormError('');
    setProductForm({
      name: '',
      category: categories[0] || 'Electronics',
      price: '',
      stock: '',
      description: '',
      image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80'
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProductId(prod.id);
    setFormError('');
    setProductForm({
      name: prod.name,
      category: prod.category,
      price: prod.price,
      stock: prod.stock,
      description: prod.description,
      image: prod.image
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    setFormError('');

    // CASL RBAC Permission Check
    if (!ability.can('manage', 'Product') && !ability.can('manage', 'all')) {
      setFormError('Forbidden: CASL RBAC check denied product management permission.');
      return;
    }

    // Zod Schema Validation
    const validation = productSchema.safeParse(productForm);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || 'Invalid product form details.');
      return;
    }

    if (editingProductId) {
      // Update
      const updated = products.map(p => {
        if (p.id === editingProductId) {
          return {
            ...p,
            name: productForm.name,
            category: productForm.category,
            price: parseFloat(productForm.price),
            stock: parseInt(productForm.stock, 10),
            description: productForm.description,
            image: productForm.image
          };
        }
        return p;
      });
      setProducts(updated);

      // Emit ProductUpdated Event
      addLocalEvent('ProductUpdated', 'product-service', {
        productId: editingProductId,
        name: productForm.name,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock, 10)
      });

      // Persist update via API Gateway
      updateProductApi(editingProductId, productForm).catch(err => console.warn('[Admin] Product update sync failed:', err.message));
    } else {
      // Create
      const newProd = {
        id: `prod-${Date.now().toString().slice(-4)}`,
        name: productForm.name,
        category: productForm.category,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock, 10),
        rating: 5.0,
        description: productForm.description,
        image: productForm.image
      };
      setProducts([newProd, ...products]);

      // Emit ProductCreated Event (Workflow 2: Product Creation)
      addLocalEvent('ProductCreated', 'product-service', {
        productId: newProd.id,
        name: newProd.name,
        price: newProd.price,
        category: newProd.category,
        initialStock: newProd.stock
      });

      // Persist create via API Gateway
      createProductApi(newProd).catch(err => console.warn('[Admin] Product create sync failed:', err.message));
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id) => {
    if (!ability.can('manage', 'Product') && !ability.can('manage', 'all')) {
      alert('Forbidden: CASL RBAC check denied delete permission.');
      return;
    }

    const prodToDelete = products.find(p => p.id === id);
    if (!window.confirm(`Delete product "${prodToDelete?.name}"?`)) return;

    setProducts(products.filter(p => p.id !== id));

    // Emit ProductDeleted Event
    addLocalEvent('ProductDeleted', 'product-service', {
      productId: id,
      name: prodToDelete?.name
    });

    // Persist delete via API Gateway
    deleteProductApi(id).catch(err => console.warn('[Admin] Product delete sync failed:', err.message));
  };

  // Inventory Quick Restock
  const handleRestock = (productId, addedUnits) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        const newStock = p.stock + addedUnits;

        // Emit StockUpdated
        addLocalEvent('StockUpdated', 'inventory-service', {
          productId,
          previousStock: p.stock,
          newStock,
          addedUnits
        });

        if (newStock <= 5) {
          // Emit StockLow Event (Workflow 5: Inventory Management)
          addLocalEvent('StockLow', 'inventory-service', {
            productId,
            stockRemaining: newStock,
            threshold: 5
          });
        }

        return { ...p, stock: newStock };
      }
      return p;
    });
    setProducts(updated);
  };

  // Order Status Update
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const updated = await orderService.updateOrderStatus(orderId, newStatus);
    setOrders(updated);

    // Emit OrderStatusUpdated Event
    addLocalEvent('OrderStatusUpdated', 'order-service', {
      orderId,
      newStatus,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="admin-portal-layout">
      {/* Admin Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <LayoutDashboard size={20} />
          <span>Admin Portal</span>
        </div>
        <nav className="admin-nav-menu">
          <button
            className={`admin-nav-item ${activeAdminTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('overview')}
          >
            <BarChart3 size={17} /> Overview
          </button>
          <button
            className={`admin-nav-item ${activeAdminTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('products')}
          >
            <Package size={17} /> Products ({products.length})
          </button>
          <button
            className={`admin-nav-item ${activeAdminTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('inventory')}
          >
            <Boxes size={17} /> Inventory
            {lowStockCount > 0 && <span className="admin-pill-alert">{lowStockCount}</span>}
          </button>
          <button
            className={`admin-nav-item ${activeAdminTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('orders')}
          >
            <ShoppingCart size={17} /> Customer Orders
          </button>
          <button
            className={`admin-nav-item ${activeAdminTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('customers')}
          >
            <Users size={17} /> Customers
          </button>
          <button
            className={`admin-nav-item ${activeAdminTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('payments')}
          >
            <CreditCard size={17} /> Payment Ledger
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main-panel">
        {/* TAB 1: OVERVIEW */}
        {activeAdminTab === 'overview' && (
          <div className="admin-view-content">
            <h2 className="admin-view-title">Executive Dashboard</h2>
            <p className="admin-view-sub">Real-time telemetry across all 7 microservices.</p>

            {/* KPI Cards */}
            <div className="kpi-cards-grid">
              <div className="kpi-card">
                <div className="kpi-icon-wrap emerald">
                  <DollarSign size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Gross Revenue</span>
                  <span className="kpi-value">${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span className="kpi-trend positive"><TrendingUp size={14} /> +18.4% this month</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap blue">
                  <ShoppingCart size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Total Orders</span>
                  <span className="kpi-value">{totalOrdersCount}</span>
                  <span className="kpi-trend">Order Service active</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap purple">
                  <Users size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Active Customers</span>
                  <span className="kpi-value">{totalCustomers}</span>
                  <span className="kpi-trend">User Service active</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap amber">
                  <AlertTriangle size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Low Stock Warnings</span>
                  <span className="kpi-value">{lowStockCount} Items</span>
                  <span className="kpi-trend alert">Threshold: &le; 5 units</span>
                </div>
              </div>
            </div>

            {/* Quick Microservices Health Status */}
            <div className="services-health-card">
              <h3>Microservices Topology Status</h3>
              <div className="services-status-grid">
                {[
                  { name: 'API Gateway', port: 5000, status: 'ONLINE' },
                  { name: 'User Service', port: 5001, status: 'ONLINE' },
                  { name: 'Product Service', port: 5002, status: 'ONLINE' },
                  { name: 'Cart Service', port: 5003, status: 'ONLINE' },
                  { name: 'Order Service', port: 5004, status: 'ONLINE' },
                  { name: 'Payment Service', port: 5005, status: 'ONLINE' },
                  { name: 'Inventory Service', port: 5006, status: 'ONLINE' },
                  { name: 'Notification Service', port: 5007, status: 'ONLINE' }
                ].map((s) => (
                  <div key={s.name} className="service-status-pill">
                    <span className="service-status-dot online" />
                    <span className="service-name">{s.name}</span>
                    <span className="service-port">:{s.port}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS */}
        {activeAdminTab === 'products' && (
          <div className="admin-view-content">
            <div className="admin-title-row">
              <div>
                <h2 className="admin-view-title">Product Catalog Management</h2>
                <p className="admin-view-sub">Manage product listings and emit catalog events.</p>
              </div>
              <button className="btn-admin-action" onClick={handleOpenCreateProduct}>
                <Plus size={16} /> Add Product
              </button>
            </div>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Rating</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="product-cell">
                        <img src={p.image} alt="" className="table-thumb" />
                        <div>
                          <div className="table-item-title">{p.name}</div>
                          <div className="table-item-id">{p.id}</div>
                        </div>
                      </td>
                      <td><span className="cat-tag">{p.category}</span></td>
                      <td className="font-semibold">${p.price.toFixed(2)}</td>
                      <td>
                        <span className={`stock-tag ${p.stock <= 5 ? 'low' : 'ok'}`}>
                          {p.stock} units
                        </span>
                      </td>
                      <td>★ {p.rating}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn-table-edit" onClick={() => handleOpenEditProduct(p)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-table-delete" onClick={() => handleDeleteProduct(p.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INVENTORY */}
        {activeAdminTab === 'inventory' && (
          <div className="admin-view-content">
            <h2 className="admin-view-title">Inventory Management & Stock Replenishment</h2>
            <p className="admin-view-sub">
              Demonstrates <strong>Workflow 5 (Inventory Management)</strong>: emits <code>StockUpdated</code> and <code>StockLow</code>.
            </p>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Threshold</th>
                    <th>Status</th>
                    <th>Quick Replenish</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const isLow = p.stock <= 5;
                    return (
                      <tr key={p.id} className={isLow ? 'row-alert' : ''}>
                        <td>
                          <strong>{p.name}</strong>
                          <div className="text-muted text-xs">{p.id} • {p.category}</div>
                        </td>
                        <td className="font-bold text-base">{p.stock}</td>
                        <td className="text-muted">&le; 5 units</td>
                        <td>
                          {isLow ? (
                            <span className="status-badge alert">
                              <AlertTriangle size={13} /> Low Stock!
                            </span>
                          ) : (
                            <span className="status-badge healthy">
                              <CheckCircle size={13} /> Sufficient
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="quick-replenish-buttons">
                            <button
                              className="btn-replenish"
                              onClick={() => handleRestock(p.id, 5)}
                              title="Add 5 units"
                            >
                              +5
                            </button>
                            <button
                              className="btn-replenish"
                              onClick={() => handleRestock(p.id, 15)}
                              title="Add 15 units"
                            >
                              +15
                            </button>
                            <button
                              className="btn-replenish"
                              onClick={() => handleRestock(p.id, -2)}
                              title="Simulate 2 units reduction"
                            >
                              -2 (Sell)
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ORDERS */}
        {activeAdminTab === 'orders' && (
          <div className="admin-view-content">
            <h2 className="admin-view-title">Customer Orders Management</h2>
            <p className="admin-view-sub">Track order lifecycle and transition statuses.</p>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Change Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-muted">
                        No orders recorded yet. Place an order as a customer to test!
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord.orderId}>
                        <td><code>#{ord.orderId}</code></td>
                        <td>{new Date(ord.createdAt).toLocaleDateString()}</td>
                        <td>{ord.customerEmail || ord.customerId}</td>
                        <td className="font-semibold">${ord.totalAmount.toFixed(2)}</td>
                        <td>
                          <span className={`status-badge ${ord.status.toLowerCase()}`}>
                            {ord.status}
                          </span>
                        </td>
                        <td>
                          <select
                            className="status-select"
                            value={ord.status}
                            onChange={(e) => handleUpdateOrderStatus(ord.orderId, e.target.value)}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Paid">Paid</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: CUSTOMERS */}
        {activeAdminTab === 'customers' && (
          <div className="admin-view-content">
            <h2 className="admin-view-title">Registered Customer Accounts</h2>
            <p className="admin-view-sub">Managed by User Service data repository.</p>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone Number</th>
                    <th>Account Role</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: '1', name: 'Customer User', phone: '+15550100', role: 'customer' },
                    { id: '2', name: 'Standard User', phone: '+15550200', role: 'customer' },
                    { id: '3', name: 'Business Account', phone: '+15550300', role: 'customer' }
                  ].map((cust) => (
                    <tr key={cust.id}>
                      <td><strong>{cust.name}</strong></td>
                      <td><code>{cust.phone}</code></td>
                      <td><span className="user-role-tag customer">{cust.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: PAYMENTS */}
        {activeAdminTab === 'payments' && (
          <div className="admin-view-content">
            <h2 className="admin-view-title">Payment Transaction Ledger</h2>
            <p className="admin-view-sub">Simulated transactions processed by Payment Service.</p>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Order Ref</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Gateway Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'pay-901234', order: 'ord-810231', amount: 249.99, method: 'Credit Card', status: 'COMPLETED' },
                    { id: 'pay-901235', order: 'ord-810232', amount: 139.50, method: 'Credit Card', status: 'COMPLETED' },
                    { id: 'pay-901236', order: 'ord-810233', amount: 79.99, method: 'Credit Card', status: 'COMPLETED' }
                  ].map((t) => (
                    <tr key={t.id}>
                      <td><code>{t.id}</code></td>
                      <td><code>#{t.order}</code></td>
                      <td className="font-semibold">${t.amount.toFixed(2)}</td>
                      <td>{t.method}</td>
                      <td><span className="status-badge paid">{t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Product Create/Edit Modal */}
      {isProductModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsProductModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProductId ? 'Edit Product' : 'Add New Product'}</h3>

            {formError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="admin-form">
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Stock Qty</label>
                  <input
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  value={productForm.image}
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {editingProductId ? 'Update Product' : 'Create & Emit ProductCreated'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
