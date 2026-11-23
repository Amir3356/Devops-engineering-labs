import { useState, useEffect } from 'react';
import { useEvents } from '../../context/EventContext';
import { useAuth } from '../../context/AuthContext';
import { useAbility } from '../../context/AbilityContext';
import { productSchema } from '../../utils/validators';
import orderService from '../../services/order.service';
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  uploadProductImageApi,
  getCategoriesApi,
  createCategoryApi
} from '../../api/product.api';
import {
  getAllStockApi,
  updateStockApi,
  replenishStockApi
} from '../../api/inventory.api';
import { getCustomersApi } from '../../api/auth.api';
import { getAllPaymentRecordsApi } from '../../api/payment.api';
import {
  Layers,
  Boxes,
  ShoppingCart,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  DollarSign,
  Upload,
  Loader2,
  Search,
  Filter,
  LogOut,
  User,
  ChevronDown,
  RotateCw,
  CheckCircle2,
  XCircle,
  Warehouse,
  Package,
  FolderTree,
  Tag
} from 'lucide-react';

const DEFAULT_PRODUCT_OPTIONS = [
  'Wireless Noise-Canceling Headphones',
  'Ergonomic Mechanical Keyboard',
  'Ultra-HD Smart Fitness Watch',
  'Mechanical Gaming Keyboard',
  'Ultra-Wide 4K Gaming Monitor',
  'Studio Condenser Microphone',
  'USB-C Multi-Port Hub Pro',
  'Wireless Ergonomic Mouse',
  'True Wireless Earbuds',
  'Smart Ambient Light Bar'
];

export default function AdminDashboard() {
  const { addLocalEvent } = useEvents();
  const { user, logout } = useAuth();
  const ability = useAbility();

  // Navigation tab state - default to 'catalog'
  const [activeAdminTab, setActiveAdminTab] = useState('catalog'); // 'catalog' | 'inventory' | 'orders' | 'payments'

  // Microservices live data state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);

  const productDropdownOptions = Array.from(
    new Set([
      ...products.map((p) => p.name).filter(Boolean),
      ...DEFAULT_PRODUCT_OPTIONS
    ])
  );
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter states
  const [productQuery, setProductQuery] = useState('');
  const [productCategory, setProductCategory] = useState('All');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'out' | 'optimal'

  // Product Create/Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [formError, setFormError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Electronics',
    price: '',
    stock: '',
    description: '',
    image: ''
  });

  // Category Create Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [categoryError, setCategoryError] = useState('');
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  // Stock Adjustment Modal State (Inventory Service)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustMode, setAdjustMode] = useState('set'); // 'set' | 'replenish'
  const [adjustQty, setAdjustQty] = useState('');
  const [replenishAmount, setReplenishAmount] = useState('10');
  const [adjustError, setAdjustError] = useState('');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // Fetch all live microservices data
  const fetchAllData = () => {
    return Promise.allSettled([
      getProductsApi(),
      getCategoriesApi(),
      getAllStockApi(),
      orderService.fetchAllAdminOrders(),
      getCustomersApi(),
      getAllPaymentRecordsApi()
    ]).then(([prodRes, catRes, invRes, ordsRes, custRes, payRes]) => {
      if (prodRes.status === 'fulfilled' && prodRes.value?.success && Array.isArray(prodRes.value.data)) {
        setProducts(prodRes.value.data);
      } else {
        setProducts([]);
      }

      if (catRes.status === 'fulfilled' && catRes.value?.success && Array.isArray(catRes.value.data)) {
        setCategories(catRes.value.data);
      } else {
        setCategories([]);
      }

      if (invRes.status === 'fulfilled' && invRes.value?.success && Array.isArray(invRes.value.data)) {
        setInventory(invRes.value.data);
      } else {
        setInventory([]);
      }

      if (ordsRes.status === 'fulfilled' && Array.isArray(ordsRes.value)) {
        setOrders(ordsRes.value);
      } else {
        setOrders([]);
      }

      if (custRes.status === 'fulfilled' && custRes.value?.success && Array.isArray(custRes.value.data)) {
        setCustomers(custRes.value.data);
      } else {
        setCustomers([]);
      }

      if (payRes.status === 'fulfilled' && payRes.value?.success && Array.isArray(payRes.value.data)) {
        setPayments(payRes.value.data);
      } else {
        setPayments([]);
      }
    });
  };

  useEffect(() => {
    setIsLoading(true);
    fetchAllData().finally(() => {
      setIsLoading(false);
    });
  }, []);

  const handleRefreshCatalog = async () => {
    setIsRefreshing(true);
    try {
      const [prodRes, catRes] = await Promise.all([getProductsApi(), getCategoriesApi()]);
      if (prodRes?.success && Array.isArray(prodRes.data)) setProducts(prodRes.data);
      if (catRes?.success && Array.isArray(catRes.data)) setCategories(catRes.data);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Metric helpers
  const lowStockCount = inventory.filter(
    (item) => (Number(item.stockQuantity) || 0) <= (item.lowStockThreshold || 5) && (Number(item.stockQuantity) || 0) > 0
  ).length;
  const outOfStockCount = inventory.filter((item) => (Number(item.stockQuantity) || 0) <= 0).length;
  const inStockCount = inventory.filter(
    (item) => (Number(item.stockQuantity) || 0) > (item.lowStockThreshold || 5)
  ).length;

  // Filtered lists
  const filteredProducts = products.filter((p) => {
    const q = productQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      (p.name || '').toLowerCase().includes(q) ||
      String(p.id).toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q);
    const matchesCategory = productCategory === 'All' || p.category === productCategory;
    return matchesQuery && matchesCategory;
  });

  const filteredCategories = categories.filter((c) => {
    const q = categoryQuery.trim().toLowerCase();
    return (
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.slug || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  });

  const filteredInventory = inventory.filter((item) => {
    const q = inventoryQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      (item.productName || '').toLowerCase().includes(q) ||
      (item.productId || '').toLowerCase().includes(q);

    const qty = Number(item.stockQuantity) || 0;
    const threshold = item.lowStockThreshold || 5;

    let matchesFilter = true;
    if (stockFilter === 'low') {
      matchesFilter = qty <= threshold && qty > 0;
    } else if (stockFilter === 'out') {
      matchesFilter = qty <= 0;
    } else if (stockFilter === 'in' || stockFilter === 'optimal') {
      matchesFilter = qty > threshold;
    }

    return matchesQuery && matchesFilter;
  });

  // =========================================================================
  // Product Handlers (Multer upload + Product Service)
  // =========================================================================
  const handleOpenCreateProduct = () => {
    setEditingProductId(null);
    setFormError('');
    setImagePreview('');
    setIsUploadingImage(false);
    setProductForm({
      name: productDropdownOptions[0] || 'Wireless Noise-Canceling Headphones',
      category: categories[0]?.name || 'Electronics',
      price: '29.99',
      stock: '10',
      description: '',
      image: ''
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProductId(prod.id);
    setFormError('');
    setImagePreview(prod.image || '');
    setIsUploadingImage(false);
    setProductForm({
      name: prod.name,
      category: prod.category,
      price: prod.price || '29.99',
      stock: prod.stock != null ? String(prod.stock) : '10',
      description: prod.description || '',
      image: prod.image || ''
    });
    setIsProductModalOpen(true);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('Image size exceeds 10MB limit.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setFormError('');

    setIsUploadingImage(true);
    try {
      const res = await uploadProductImageApi(file);
      if (res && res.data?.url) {
        setProductForm((prev) => ({ ...prev, image: res.data.url }));
      }
    } catch (err) {
      setFormError(`Image upload failed: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    setProductForm((prev) => ({ ...prev, image: '' }));
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!ability.can('manage', 'Product') && !ability.can('manage', 'all')) {
      setFormError('Forbidden: CASL RBAC check denied product management permission.');
      return;
    }

    const payload = {
      name: (productForm.name || '').trim(),
      category: (productForm.category || '').trim(),
      price: productForm.price ? parseFloat(productForm.price) : 29.99,
      stock: productForm.stock !== '' && productForm.stock != null ? parseInt(productForm.stock, 10) : 10,
      description: productForm.description || '',
      image: productForm.image || ''
    };

    const validation = productSchema.safeParse(payload);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || 'Invalid product form details.');
      return;
    }

    if (editingProductId) {
      try {
        const res = await updateProductApi(editingProductId, payload);
        const updatedProd = res && res.success && res.data ? res.data : { id: editingProductId, ...payload };

        setProducts((prev) => prev.map((p) => (p.id === editingProductId ? updatedProd : p)));

        addLocalEvent('ProductUpdated', 'product-service', {
          productId: editingProductId,
          name: updatedProd.name,
          price: updatedProd.price,
          stock: updatedProd.stock
        });

        setIsProductModalOpen(false);
      } catch (err) {
        setFormError(err.message || 'Failed to update product');
      }
    } else {
      try {
        const res = await createProductApi(payload);
        if (res && res.success && res.data) {
          setProducts((prev) => [res.data, ...prev]);

          addLocalEvent('ProductCreated', 'product-service', {
            productId: res.data.id,
            name: res.data.name,
            price: res.data.price,
            category: res.data.category,
            initialStock: res.data.stock
          });
          setIsProductModalOpen(false);
        } else {
          throw new Error(res?.message || 'Could not create product');
        }
      } catch (err) {
        setFormError(err.message || 'Failed to create product');
      }
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!ability.can('manage', 'Product') && !ability.can('manage', 'all')) {
      alert('Forbidden: CASL RBAC check denied delete permission.');
      return;
    }

    const prodToDelete = products.find((p) => p.id === id);
    if (!window.confirm(`Delete product "${prodToDelete?.name}"?`)) return;

    try {
      await deleteProductApi(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));

      addLocalEvent('ProductDeleted', 'product-service', {
        productId: id,
        name: prodToDelete?.name
      });
    } catch (err) {
      alert('Delete product failed: ' + err.message);
    }
  };

  // =========================================================================
  // Category Handlers (Product Service)
  // =========================================================================
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setCategoryError('');

    if (!categoryForm.name.trim()) {
      setCategoryError('Category name is required.');
      return;
    }

    setIsSubmittingCategory(true);
    try {
      const res = await createCategoryApi({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim()
      });

      if (res && res.success && res.data) {
        setCategories((prev) => [...prev, res.data]);

        addLocalEvent('CategoryCreated', 'product-service', {
          categoryId: res.data.id,
          name: res.data.name,
          slug: res.data.slug
        });

        setIsCategoryModalOpen(false);
        setCategoryForm({ name: '', description: '' });
      } else {
        throw new Error(res?.message || 'Failed to create category');
      }
    } catch (err) {
      setCategoryError(err.message || 'Category creation failed');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  // =========================================================================
  // Inventory Handlers (Inventory Service)
  // =========================================================================
  const handleQuickReplenish = async (item, amount = 10) => {
    try {
      const res = await replenishStockApi({
        productId: item.productId,
        amount: Number(amount)
      });

      if (res && res.success && res.data) {
        setInventory((prev) =>
          prev.map((inv) => (inv.productId === item.productId ? res.data : inv))
        );

        addLocalEvent('StockUpdated', 'inventory-service', {
          productId: item.productId,
          productName: item.productName,
          action: 'REPLENISH',
          amountAdded: amount,
          newStockQuantity: res.data.stockQuantity
        });
      }
    } catch (err) {
      alert(`Replenish failed: ${err.message}`);
    }
  };

  const handleOpenAdjustModal = (item) => {
    setAdjustItem(item);
    setAdjustMode('set');
    setAdjustQty(String(item.stockQuantity));
    setReplenishAmount('10');
    setAdjustError('');
    setIsAdjustModalOpen(true);
  };

  const handleSubmitStockChange = async (e) => {
    e.preventDefault();
    setAdjustError('');

    setIsSubmittingStock(true);
    try {
      if (adjustMode === 'set') {
        const parsedQty = parseInt(adjustQty, 10);
        if (isNaN(parsedQty) || parsedQty < 0) {
          setAdjustError('Please enter a valid stock quantity (0 or greater).');
          setIsSubmittingStock(false);
          return;
        }

        const res = await updateStockApi(adjustItem.productId, {
          stockQuantity: parsedQty,
          productName: adjustItem.productName
        });

        if (res && res.success && res.data) {
          setInventory((prev) =>
            prev.map((inv) => (inv.productId === adjustItem.productId ? res.data : inv))
          );

          addLocalEvent('StockUpdated', 'inventory-service', {
            productId: adjustItem.productId,
            productName: adjustItem.productName,
            action: 'OVERRIDE_STOCK',
            newStockQuantity: res.data.stockQuantity
          });
          setIsAdjustModalOpen(false);
        } else {
          throw new Error(res?.message || 'Failed to update stock quantity');
        }
      } else {
        const parsedAmount = parseInt(replenishAmount, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          setAdjustError('Please enter a valid replenishment amount greater than 0.');
          setIsSubmittingStock(false);
          return;
        }

        const res = await replenishStockApi({
          productId: adjustItem.productId,
          amount: parsedAmount
        });

        if (res && res.success && res.data) {
          setInventory((prev) =>
            prev.map((inv) => (inv.productId === adjustItem.productId ? res.data : inv))
          );

          addLocalEvent('StockUpdated', 'inventory-service', {
            productId: adjustItem.productId,
            productName: adjustItem.productName,
            action: 'REPLENISH',
            amountAdded: parsedAmount,
            newStockQuantity: res.data.stockQuantity
          });
          setIsAdjustModalOpen(false);
        } else {
          throw new Error(res?.message || 'Failed to replenish stock');
        }
      }
    } catch (err) {
      setAdjustError(err.message || 'Error modifying inventory');
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // Order Status Update
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const updated = await orderService.updateOrderStatus(orderId, newStatus);
    setOrders(updated);

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
        <div className="side-brand">
          <div className="side-brand-icon">
            <Warehouse size={20} />
          </div>
          <div className="side-brand-text">
            <span className="side-brand-name">NexusCommerce</span>
            <span className="side-brand-sub">Admin RBAC Portal</span>
          </div>
        </div>

        <nav className="admin-nav-menu">
          <span className="side-section-label">Catalog Management</span>
          <button
            className={`admin-nav-item ${activeAdminTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('catalog')}
          >
            <Layers size={18} />
            <span>Products &amp; Categories</span>
            <span className="admin-nav-count">{products.length}</span>
          </button>

          <span className="side-section-label">Warehouse Operations</span>
          {/* INVENTORY SIDEBAR ITEM */}
          <button
            className={`admin-nav-item ${activeAdminTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('inventory')}
          >
            <Boxes size={18} />
            <span>Inventory</span>
            <span className="admin-nav-count">
              {inventory.length}
              {lowStockCount > 0 && <span className="text-amber" title={`${lowStockCount} Low Stock`}>⚠️</span>}
            </span>
          </button>

          <span className="side-section-label">Sales & Fulfillment</span>
          <button
            className={`admin-nav-item ${activeAdminTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('orders')}
          >
            <ShoppingCart size={18} />
            <span>Customer Orders</span>
            <span className="admin-nav-count">{orders.length}</span>
          </button>

          <span className="side-section-label">Financial Ledger</span>
          <button
            className={`admin-nav-item ${activeAdminTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('payments')}
          >
            <DollarSign size={18} />
            <span>Payments</span>
            <span className="admin-nav-count">{payments.length}</span>
          </button>
        </nav>

        <div className="side-footer">
          <div className="side-user-card">
            <div className="side-user-avatar">
              <User size={18} />
            </div>
            <div className="side-user-info">
              <span className="side-user-name">{user?.name || 'Administrator'}</span>
              <span className="side-user-role">{user?.role || 'admin'}</span>
              <span className="side-user-contact">{user?.email || user?.phone}</span>
            </div>
          </div>
          <button type="button" className="side-signout-btn" onClick={logout}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="topbar-user-chip">
            <span className="topbar-avatar">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
            <span className="topbar-user-text">
              <span className="topbar-user-name">{user?.name || 'Administrator'}</span>
              <span className="topbar-user-role">{user?.role || 'admin'} (RBAC Active)</span>
            </span>
            <ChevronDown size={16} />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="admin-main-panel">
          {/* TAB 1: PRODUCT & CATEGORY MANAGEMENT */}
          {(activeAdminTab === 'catalog' || activeAdminTab === 'products') && (
            <div className="admin-view-content">
              {/* Header */}
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Product &amp; Category Management</h2>
                  <p className="admin-view-sub">
                    Manage catalog products, pricing, categories, and image assets via <strong>Product Service</strong> (Port 5002).
                  </p>
                </div>
                <div className="admin-header-actions">
                  <button
                    type="button"
                    className="btn-admin-action"
                    onClick={handleOpenCreateProduct}
                  >
                    <Plus size={16} />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* PRODUCTS SECTION */}
              <div>
                <div className="admin-filter-card">
                  <div className="admin-search-field">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search products by title, SKU, or category..."
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                    />
                  </div>
                  <div className="admin-filter-row">
                    <Filter size={16} className="admin-filter-icon" />
                    <select
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span className="admin-filter-total">
                      Total: <strong>{filteredProducts.length}</strong> products
                    </span>
                  </div>
                </div>

                {isLoading ? (
                  <div className="admin-table-loading" style={{ textAlign: 'center', padding: '40px' }}>
                    <Loader2 size={32} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading live catalog from Product Service...</p>
                  </div>
                ) : (
                  <div className="admin-table-card">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Images</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-muted">
                              No products found. Click "Add" to create one in PostgreSQL!
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p) => {
                            return (
                              <tr key={p.id}>
                                <td className="product-cell">
                                  <div className="table-item-title font-semibold">{p.name}</div>
                                </td>
                                <td>
                                  <span className="cat-tag">{p.category}</span>
                                </td>
                                <td>
                                  <img
                                    src={
                                      p.image ||
                                      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
                                    }
                                    alt={p.name}
                                    className="table-thumb"
                                    style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                                  />
                                </td>
                                <td>
                                  <div className="table-actions">
                                    <button
                                      type="button"
                                      className="btn-table-edit"
                                      onClick={() => handleOpenEditProduct(p)}
                                      title="Edit Product"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-table-delete"
                                      onClick={() => handleDeleteProduct(p.id)}
                                      title="Delete Product"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    <div className="admin-table-footer">
                      <span>
                        Showing <strong>{filteredProducts.length === 0 ? 0 : 1}–{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY MANAGEMENT */}
          {activeAdminTab === 'inventory' && (
            <div className="admin-view-content">
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Inventory Management &amp; Stock Control</h2>
                  <p className="admin-view-sub">
                    Direct real-time warehouse telemetry and adjustments powered by <strong>Inventory Service</strong> (Port 5006).
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-admin-action"
                  onClick={async () => {
                    setIsRefreshing(true);
                    try {
                      const res = await getAllStockApi();
                      if (res?.success && Array.isArray(res.data)) setInventory(res.data);
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  title="Synchronize with Inventory Service"
                >
                  <RotateCw size={16} className={isRefreshing ? 'spin-icon' : ''} />
                  <span>{isRefreshing ? 'Syncing...' : 'Refresh Stock'}</span>
                </button>
              </div>

              {/* Filter and Search Bar */}
              <div className="admin-filter-card">
                <div className="admin-search-field">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search inventory by product name or product ID..."
                    value={inventoryQuery}
                    onChange={(e) => setInventoryQuery(e.target.value)}
                  />
                </div>

                <div className="admin-filter-row">
                  <Filter size={16} className="admin-filter-icon" />
                  <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                    <option value="all">All Inventory ({inventory.length})</option>
                    <option value="in">In Stock ({inStockCount})</option>
                    <option value="low">Low Stock ({lowStockCount})</option>
                    <option value="out">Out of Stock ({outOfStockCount})</option>
                  </select>
                  <span className="admin-filter-total">
                    Showing: <strong>{filteredInventory.length}</strong> of <strong>{inventory.length}</strong> items
                  </span>
                </div>
              </div>

              {/* Inventory Table */}
              {isLoading ? (
                <div className="admin-table-loading" style={{ textAlign: 'center', padding: '50px' }}>
                  <Loader2 size={36} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)' }}>Connecting to Inventory Service and loading stock ledger...</p>
                </div>
              ) : (
                <div className="admin-table-card">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Current Stock</th>
                        <th>Expires at</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-muted">
                            No inventory items match your search or filter.
                          </td>
                        </tr>
                      ) : (
                        filteredInventory.map((item) => {
                          const qty = Number(item.stockQuantity) || 0;
                          const threshold = item.lowStockThreshold || 5;
                          const isLow = qty <= threshold && qty > 0;
                          const isOut = qty <= 0;
                          const matchedProduct = products.find(
                            (p) => String(p.id) === String(item.productId)
                          );
                          const categoryName = item.category || matchedProduct?.category || 'General';
                          const cleanId =
                            String(item.productId || '').replace(/\D/g, '') ||
                            String(item.productId || '').slice(-3).toUpperCase();
                          const batchId =
                            item.batchId ||
                            item.batch_id ||
                            `BAT-${cleanId.padStart(3, '0')}-2026`;
                          const expiresAt = item.expiresAt || item.expires_at || '2028-11-30';

                          return (
                            <tr key={item.productId}>
                              <td>
                                <code className="cat-slug font-mono">{batchId}</code>
                              </td>

                              <td className="product-cell">
                                <div className="table-item-title font-semibold">{item.productName}</div>
                              </td>

                              <td>
                                <span className="cat-tag">{categoryName}</span>
                              </td>

                              <td>
                                <span className={`stock-tag ${isOut ? 'low font-bold text-red-500' : isLow ? 'low font-bold text-amber' : 'ok font-bold text-emerald'}`}>
                                  {qty} units
                                </span>
                              </td>

                              <td className="text-muted text-sm font-mono">
                                {expiresAt}
                              </td>

                              <td>
                                {isOut ? (
                                  <span className="status-badge cancelled">
                                    <XCircle size={13} /> Out of Stock
                                  </span>
                                ) : isLow ? (
                                  <span className="status-badge pending" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                                    <AlertTriangle size={13} /> Low Stock
                                  </span>
                                ) : (
                                  <span className="status-badge paid">
                                    <CheckCircle2 size={13} /> In Stock
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  <div className="admin-table-footer">
                    <span>
                      Live Inventory Ledger • Verified against <strong>inventory_db</strong> in PostgreSQL
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOMER ORDERS */}
          {activeAdminTab === 'orders' && (
            <div className="admin-view-content">
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Customer Orders Management</h2>
                  <p className="admin-view-sub">Track order lifecycle and transition statuses.</p>
                </div>
              </div>

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
                      orders.map((ord) => {
                        const total = Number(ord.totalAmount) || 0;
                        return (
                          <tr key={ord.orderId || ord.id}>
                            <td><code>#{ord.orderId || ord.id}</code></td>
                            <td>{new Date(ord.createdAt).toLocaleDateString()}</td>
                            <td>{ord.customerEmail || ord.customerId}</td>
                            <td className="font-semibold">${total.toFixed(2)}</td>
                            <td>
                              <span className={`status-badge ${(ord.status || 'pending').toLowerCase()}`}>
                                {ord.status}
                              </span>
                            </td>
                            <td>
                              <select
                                className="status-select"
                                value={ord.status}
                                onChange={(e) => handleUpdateOrderStatus(ord.orderId || ord.id, e.target.value)}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENTS */}
          {activeAdminTab === 'payments' && (
            <div className="admin-view-content">
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Payment Transaction Ledger</h2>
                  <p className="admin-view-sub">Real transactions processed by Payment Service.</p>
                </div>
              </div>

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
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-muted">
                          No payment transactions recorded in Payment Service ledger.
                        </td>
                      </tr>
                    ) : (
                      payments.map((t) => {
                        const amount = Number(t.amount) || 0;
                        return (
                          <tr key={t.id || t.paymentId}>
                            <td><code>{t.id || t.paymentId}</code></td>
                            <td><code>#{t.orderId}</code></td>
                            <td className="font-semibold">${amount.toFixed(2)}</td>
                            <td>{t.paymentMethod || 'Card'}</td>
                            <td><span className="status-badge paid">{t.status}</span></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Product Create/Edit Modal (With Multer Image Upload) */}
      {isProductModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsProductModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProductId ? 'Edit Product' : 'Add Product'}</h3>

            {formError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="admin-form">
              <div className="form-group">
                <label>Product</label>
                <select
                  value={productForm.name}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const matched = products.find((p) => p.name === selectedName);
                    setProductForm((prev) => ({
                      ...prev,
                      name: selectedName,
                      category: matched?.category || prev.category,
                      image: matched?.image || prev.image
                    }));
                    if (matched?.image) {
                      setImagePreview(matched.image);
                    }
                  }}
                  required
                >
                  <option value="" disabled>-- Select a Product --</option>
                  {productDropdownOptions.map((prodName) => (
                    <option key={prodName} value={prodName}>
                      {prodName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                >
                  {(categories.length > 0 ? categories.map((c) => c.name) : ['Electronics', 'Audio', 'Wearables', 'Accessories']).map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Image Upload</label>
                <div className="image-upload-wrapper">
                  {imagePreview ? (
                    <div className="image-preview-container">
                      <img src={imagePreview} alt="Product preview" className="uploaded-image-preview" />
                      <div className="image-preview-actions">
                        {isUploadingImage ? (
                          <div className="upload-status-badge">
                            <Loader2 size={16} className="spin-icon" />
                            <span>Uploading via Multer...</span>
                          </div>
                        ) : (
                          <div className="preview-action-row">
                            <label className="btn-upload-action change">
                              <Upload size={14} /> Change Image
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleImageChange}
                                style={{ display: 'none' }}
                              />
                            </label>
                            <button
                              type="button"
                              className="btn-upload-action remove"
                              onClick={handleRemoveImage}
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label className="image-dropzone">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                      />
                      <div className="dropzone-content">
                        <div className="dropzone-icon-circle">
                          {isUploadingImage ? (
                            <Loader2 size={24} className="spin-icon text-primary" />
                          ) : (
                            <Upload size={24} className="text-primary" />
                          )}
                        </div>
                        <span className="dropzone-title">
                          {isUploadingImage ? 'Uploading Image...' : 'Upload Product Image'}
                        </span>
                        <span className="dropzone-subtitle">
                          Click to browse or drop an image (JPG, PNG, WEBP, GIF up to 10MB) • Multer Engine
                        </span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {editingProductId ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Create Modal */}
      {isCategoryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-with-badge">
              <h3>Add New Category Taxonomy</h3>
              <p className="text-muted text-sm">Creates a category in Product Service PostgreSQL database</p>
            </div>

            {categoryError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{categoryError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="admin-form">
              <div className="form-group">
                <label>Category Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Smart Home, Gaming, Books"
                  required
                />
              </div>

              <div className="form-group">
                <label>Category Description</label>
                <textarea
                  rows={3}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Brief description of the product group..."
                />
              </div>

              <div className="modal-footer-btns">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsCategoryModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={isSubmittingCategory}
                >
                  {isSubmittingCategory ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal (Inventory Service) */}
      {isAdjustModalOpen && adjustItem && (
        <div className="modal-backdrop" onClick={() => setIsAdjustModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-with-badge">
              <div>
                <h3>Inventory Stock Control</h3>
                <p className="text-muted text-sm font-mono">{adjustItem.productName} ({adjustItem.productId})</p>
              </div>
            </div>

            {adjustError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{adjustError}</span>
              </div>
            )}

            <div className="auth-tab-row mb-4">
              <button
                type="button"
                className={`auth-tab-btn ${adjustMode === 'set' ? 'active' : ''}`}
                onClick={() => setAdjustMode('set')}
              >
                Set Exact Stock Level
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${adjustMode === 'replenish' ? 'active' : ''}`}
                onClick={() => setAdjustMode('replenish')}
              >
                Replenish (+ Add Units)
              </button>
            </div>

            <form onSubmit={handleSubmitStockChange} className="admin-form">
              {adjustMode === 'set' ? (
                <div className="form-group">
                  <label>New Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="Enter absolute stock quantity"
                    required
                  />
                  <span className="text-muted text-xs mt-1">
                    Current warehouse stock: <strong>{adjustItem.stockQuantity} units</strong>. This will override the stock count.
                  </span>
                </div>
              ) : (
                <div className="form-group">
                  <label>Units to Add (Replenish)</label>
                  <input
                    type="number"
                    min="1"
                    value={replenishAmount}
                    onChange={(e) => setReplenishAmount(e.target.value)}
                    placeholder="e.g. 10, 25, 50"
                    required
                  />
                  <span className="text-muted text-xs mt-1">
                    Adds units to existing stock (New total will be: <strong>{Number(adjustItem.stockQuantity) + (parseInt(replenishAmount, 10) || 0)} units</strong>).
                  </span>
                </div>
              )}

              <div className="modal-footer-btns">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsAdjustModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={isSubmittingStock}
                >
                  {isSubmittingStock ? 'Saving...' : adjustMode === 'set' ? 'Update Stock Count' : 'Replenish Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
