import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import TanStackDataTable from '../../components/TanStackDataTable';
import { useEvents } from '../../context/EventContext';
import { useAuth } from '../../context/AuthContext';
import { getPolicyApi, updatePolicyApi, resetPolicyApi, INVENTORY_ALERTS_POLICY } from '../../api/policy.api';
import { subscribeRealtime } from '../../services/realtime.service';
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
  replenishStockApi,
  deleteStockApi
} from '../../api/inventory.api';
import {
  getPurchasesApi,
  createPurchaseApi,
  updatePurchaseApi,
  deletePurchaseApi
} from '../../api/purchase.api';
import {
  getSalesApi,
  createSaleApi,
  deleteSaleApi
} from '../../api/sale.api';
import {
  Layers,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Upload,
  Loader2,
  Search,
  Filter,
  LogOut,
  User,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Warehouse,
  Settings,
  ShieldCheck,
  Clock,
  Save,
  RotateCcw,
  Sliders,
  TrendingUp,
  DollarSign
} from 'lucide-react';

// Built-in product choices for the Add Product dropdown, with a suggested category each
const DEFAULT_PRODUCT_CATALOG = [
  { name: 'Wireless Headphones', category: 'Audio', description: 'High-fidelity wireless headphones with active noise cancellation.' },
  { name: 'Bluetooth Speaker', category: 'Audio', description: 'Portable Bluetooth speaker with deep bass and waterproof design.' },
  { name: 'Smartphone', category: 'Electronics', description: 'Flagship smartphone with vivid AMOLED display and multi-camera system.' },
  { name: 'Laptop', category: 'Electronics', description: 'Ultra-thin high-performance laptop for productivity and creative work.' },
  { name: 'Mechanical Keyboard', category: 'Electronics', description: 'Tactile mechanical keyboard with customizable RGB backlighting.' },
  { name: 'Smart Watch', category: 'Wearables', description: 'Feature-rich smartwatch with heart rate monitoring and fitness tracking.' },
  { name: 'Fitness Tracker', category: 'Wearables', description: 'Lightweight water-resistant fitness band with long battery life.' },
  { name: 'USB-C Charger', category: 'Accessories', description: 'Fast-charging compact USB-C power adapter.' },
  { name: 'Phone Case', category: 'Accessories', description: 'Durable shock-absorbent protective phone case.' }
];
const DEFAULT_PRODUCT_OPTIONS = DEFAULT_PRODUCT_CATALOG.map((p) => p.name);

const DEFAULT_ALERT_SETTINGS = {
  lowStockThreshold: 10,
  expiryWarningDays: 30,
  enableLowStockAlerts: true,
  enableExpiryAlerts: true,
  highlightOutOfStock: true
};

const DEFAULT_EXPIRIES = {};

export default function AdminDashboard() {
  const { addLocalEvent } = useEvents();
  const { user, logout } = useAuth();

  // Navigation tab state - default to 'catalog'
  const [activeAdminTab, setActiveAdminTab] = useState('catalog'); // 'catalog' | 'inventory' | 'orders' | 'purchases' | 'settings'

  // Alert & Notification Settings State
  const [alertSettings, setAlertSettings] = useState(() => {
    const saved = localStorage.getItem('nexus_inventory_alert_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          lowStockThreshold: Number(parsed.lowStockThreshold) || 10,
          expiryWarningDays: Number(parsed.expiryWarningDays) || 30,
          enableLowStockAlerts: parsed.enableLowStockAlerts !== false,
          enableExpiryAlerts: parsed.enableExpiryAlerts !== false,
          highlightOutOfStock: parsed.highlightOutOfStock !== false
        };
      } catch {
        // ignore
      }
    }
    return DEFAULT_ALERT_SETTINGS;
  });

  const [settingsForm, setSettingsForm] = useState(alertSettings);

  // Alert policy lives in policy-service; localStorage is only a fallback cache
  useEffect(() => {
    let cancelled = false;
    getPolicyApi(INVENTORY_ALERTS_POLICY)
      .then((res) => {
        if (cancelled || !res?.success || !res.data?.settings) return;
        const settings = { ...DEFAULT_ALERT_SETTINGS, ...res.data.settings };
        setAlertSettings(settings);
        setSettingsForm(settings);
        localStorage.setItem('nexus_inventory_alert_settings', JSON.stringify(settings));
      })
      .catch((err) => console.warn('[AdminDashboard] Policy service unavailable, using cached alert policy:', err.message));
    return () => {
      cancelled = true;
    };
  }, []);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const getItemExpiryDate = (item) => {
    if (item.expiresAt) return item.expiresAt;
    if (item.expires_at) return item.expires_at;
    const pId = String(item.productId || '').toLowerCase();
    if (DEFAULT_EXPIRIES[pId]) return DEFAULT_EXPIRIES[pId];
    return '';
  };

  const getDaysUntilExpiry = (dateStr) => {
    if (!dateStr) return 999;
    const target = new Date(dateStr);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

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
  const productCategoryOptions =
    categories.length > 0
      ? categories.map((c) => c.name)
      : ['Electronics', 'Audio', 'Wearables', 'Accessories'];
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter states
  const [productQuery, setProductQuery] = useState('');
  const [productCategory, setProductCategory] = useState('All');
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
  const [adjustMode, setAdjustMode] = useState('replenish'); // 'replenish' | 'set'
  const [adjustQty, setAdjustQty] = useState('');
  const [replenishAmount, setReplenishAmount] = useState('10');
  const [adjustError, setAdjustError] = useState('');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);
  // Add Stock modal (stock in a paid purchase batch)
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [addStockForm, setAddStockForm] = useState({ purchaseId: '', expiresAt: '', totalSellingPrice: '' });
  const [addStockError, setAddStockError] = useState('');
  const [isSubmittingAddStock, setIsSubmittingAddStock] = useState(false);

  // Edit Stock modal (matches Add Stock layout from screenshot)
  const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
  const [editStockError, setEditStockError] = useState('');
  const [isSubmittingEditStock, setIsSubmittingEditStock] = useState(false);
  const [editStockForm, setEditStockForm] = useState({
    productId: '',
    batchId: '',
    productName: '',
    category: '',
    stockQuantity: '',
    expiresAt: '',
    totalSellingPrice: ''
  });

  // Unit selling price is derived: total selling price ÷ quantity (null until both are valid)
  const editStockUnitSellingPrice = (() => {
    const total = parseFloat(editStockForm.totalSellingPrice);
    const qty = parseInt(editStockForm.stockQuantity, 10);
    return total > 0 && qty > 0 ? Math.round((total / qty) * 100) / 100 : null;
  })();

  // Purchase State & Filter
  const [purchases, setPurchases] = useState([]);
  const [purchaseQuery, setPurchaseQuery] = useState('');
  const [purchaseCategory, setPurchaseCategory] = useState('All');
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [purchaseFormError, setPurchaseFormError] = useState('');
  const [purchaseForm, setPurchaseForm] = useState({
    batchId: '',
    productName: '',
    category: '',
    quantity: '',
    supplier: '',
    totalCost: ''
  });

  // Unit purchase price is derived: total cost ÷ quantity (null until both are valid)
  const purchaseUnitPrice = (() => {
    const total = parseFloat(purchaseForm.totalCost);
    const qty = parseInt(purchaseForm.quantity, 10);
    return total > 0 && qty > 0 ? Math.round((total / qty) * 100) / 100 : null;
  })();

  // Sale Modal State
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleFormError, setSaleFormError] = useState('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [saleForm, setSaleForm] = useState({
    batchId: '',
    productId: '',
    productName: '',
    category: '',
    quantity: '1',
    customerName: 'Direct Customer',
    customerEmail: '',
    customerPhone: ''
  });

  const [sales, setSales] = useState([]);

  // Fetch all live microservices data
  const fetchAllData = () => {
    return Promise.allSettled([
      getProductsApi(),
      getCategoriesApi(),
      getAllStockApi(),
      orderService.fetchAllAdminOrders(),
      getPurchasesApi(),
      getSalesApi()
    ]).then(([prodRes, catRes, invRes, ordsRes, purchRes, salesRes]) => {
      // Sales recorded by the admin (sale-service) — customer payments live in Customer Orders
      if (salesRes.status === 'fulfilled' && salesRes.value?.success && Array.isArray(salesRes.value.data)) {
        setSales(salesRes.value.data);
      } else {
        setSales([]);
      }

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

      if (purchRes.status === 'fulfilled' && purchRes.value?.success && Array.isArray(purchRes.value.data)) {
        setPurchases(purchRes.value.data);
      } else {
        setPurchases([]);
      }
    });
  };

  // Customer payments and other admins' changes arrive over the gateway WebSocket:
  // reload so Current Stock and Customer Orders always show the live server data.
  useEffect(() => {
    let reloadTimer = null;
    let hasConnectedBefore = false;
    const scheduleReload = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => fetchAllData(), 300);
    };
    const unsubscribe = subscribeRealtime((event) => {
      if (['orders.updated', 'catalog.updated', 'sales.updated'].includes(event.type)) scheduleReload();
      if (event.type === 'connection.open') {
        if (hasConnectedBefore) scheduleReload();
        hasConnectedBefore = true;
      }
    });
    return () => {
      clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, []); // subscribe once; fetchAllData reads fresh state when it runs

  useEffect(() => {
    try {
      localStorage.removeItem('nexus_admin_purchases');
    } catch {
      // ignore
    }
    fetchAllData().finally(() => {
      setIsLoading(false);
    });
  }, []);

  // Dynamic Metric Helpers based on Alert Settings
  const effectiveLowStockThreshold = alertSettings.lowStockThreshold || 10;
  const effectiveExpiryWarningDays = alertSettings.expiryWarningDays || 30;

  const lowStockItems = inventory.filter((item) => {
    const qty = Number(item.stockQuantity) || 0;
    return qty <= effectiveLowStockThreshold && qty > 0;
  });
  const outOfStockItems = inventory.filter((item) => (Number(item.stockQuantity) || 0) <= 0);
  const expiringItems = inventory.filter((item) => {
    const expiryDate = getItemExpiryDate(item);
    const days = getDaysUntilExpiry(expiryDate);
    return days <= effectiveExpiryWarningDays;
  });

  const lowStockCount = lowStockItems.length;
  const outOfStockCount = outOfStockItems.length;
  const expiringCount = expiringItems.length;
  const inStockCount = inventory.filter(
    (item) => (Number(item.stockQuantity) || 0) > effectiveLowStockThreshold
  ).length;

  // Sales Analytics Metrics
  const totalSalesRevenue = useMemo(
    () => sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
    [sales]
  );

  const totalItemsSold = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => {
        const items = Array.isArray(o.items) ? o.items : [];
        return sum + items.reduce((iSum, item) => iSum + (Number(item.quantity) || 1), 0);
      }, 0);
  }, [orders]);

  const completedSalesCount = useMemo(() => {
    return orders.filter((o) => o.status === 'Paid' || o.status === 'Delivered').length;
  }, [orders]);

  const averageOrderValue = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    if (validOrders.length === 0) return '0.00';
    return (totalSalesRevenue / validOrders.length).toFixed(2);
  }, [orders, totalSalesRevenue]);

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    let updated = {
      lowStockThreshold: Math.max(1, parseInt(settingsForm.lowStockThreshold, 10) || 5),
      expiryWarningDays: Math.max(1, parseInt(settingsForm.expiryWarningDays, 10) || 15),
      enableLowStockAlerts: true,
      enableExpiryAlerts: true,
      highlightOutOfStock: true
    };
    try {
      const res = await updatePolicyApi(INVENTORY_ALERTS_POLICY, updated);
      if (res?.success && res.data?.settings) updated = { ...DEFAULT_ALERT_SETTINGS, ...res.data.settings };
    } catch (err) {
      toast.error(`Policy not saved: ${err.message}`);
      return;
    }
    setAlertSettings(updated);
    setSettingsForm(updated);
    localStorage.setItem('nexus_inventory_alert_settings', JSON.stringify(updated));
    setSettingsSavedMessage('Alert configuration saved successfully!');
    toast.success('Alert configuration saved successfully!');
    setIsConfigOpen(false);
    setTimeout(() => setSettingsSavedMessage(''), 4500);
  };

  const handleResetSettings = async () => {
    try {
      await resetPolicyApi(INVENTORY_ALERTS_POLICY);
    } catch (err) {
      toast.error(`Policy not reset: ${err.message}`);
      return;
    }
    setSettingsForm(DEFAULT_ALERT_SETTINGS);
    setAlertSettings(DEFAULT_ALERT_SETTINGS);
    localStorage.setItem('nexus_inventory_alert_settings', JSON.stringify(DEFAULT_ALERT_SETTINGS));
    setSettingsSavedMessage('Alert configuration reset to defaults.');
    toast.info('Alert configuration reset to defaults.');
    setIsConfigOpen(false);
    setTimeout(() => setSettingsSavedMessage(''), 4500);
  };

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

  const filteredInventory = inventory.filter((item) => {
    const q = inventoryQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      (item.productName || '').toLowerCase().includes(q) ||
      (item.productId || '').toLowerCase().includes(q);

    const qty = Number(item.stockQuantity) || 0;
    const expiryDate = getItemExpiryDate(item);
    const daysLeft = getDaysUntilExpiry(expiryDate);

    let matchesFilter = true;
    if (stockFilter === 'low') {
      matchesFilter = qty <= effectiveLowStockThreshold && qty > 0;
    } else if (stockFilter === 'out') {
      matchesFilter = qty <= 0;
    } else if (stockFilter === 'in' || stockFilter === 'optimal') {
      matchesFilter = qty > effectiveLowStockThreshold;
    } else if (stockFilter === 'expiring') {
      matchesFilter = daysLeft <= effectiveExpiryWarningDays;
    }

    return matchesQuery && matchesFilter;
  });

  // Product Handlers (Multer upload + Product Service)
  const handleOpenCreateProduct = () => {
    setEditingProductId(null);
    setFormError('');
    setImagePreview('');
    setIsUploadingImage(false);
    setProductForm({
      name: '',
      category: productCategoryOptions[0] || '',
      price: '',
      stock: '0',
      description: '',
      image: ''
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    if (isProductPurchased(prod)) {
      toast.error(`"${prod.name}" has purchase batches and can't be edited.`);
      return;
    }
    setEditingProductId(prod.id);
    setFormError('');
    setImagePreview(prod.image || '');
    setIsUploadingImage(false);
    setProductForm({
      name: prod.name,
      category: prod.category,
      price: String(prod.price ?? 0),
      stock: prod.stock != null ? String(prod.stock) : '10',
      description: prod.description || '',
      image: prod.image || ''
    });
    setIsProductModalOpen(true);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setIsUploadingImage(true);
    setFormError('');

    try {
      const res = await uploadProductImageApi(file);
      const uploadedUrl = res?.imageUrl || res?.url;
      if (uploadedUrl) {
        setProductForm((prev) => ({ ...prev, image: uploadedUrl }));
        setImagePreview(uploadedUrl);
        addLocalEvent({
          type: 'ImageUploaded',
          filename: res.filename || file.name,
          url: uploadedUrl,
          timestamp: new Date().toISOString()
        });
      } else {
        setFormError('Failed to get uploaded image URL from server.');
      }
    } catch (err) {
      setFormError(err.message || 'Error uploading image through MinIO endpoint.');
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

    const validation = productSchema.safeParse({
      name: productForm.name,
      category: productForm.category,
      price: parseFloat(productForm.price) || 0,
      stock: parseInt(productForm.stock, 10) || 0,
      description: productForm.description,
      image: productForm.image
    });

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || 'Validation failed');
      return;
    }

    try {
      if (editingProductId) {
        const res = await updateProductApi(editingProductId, {
          name: productForm.name,
          category: productForm.category,
          price: parseFloat(productForm.price) || 0,
          stock: parseInt(productForm.stock, 10) || 0,
          description: productForm.description || '',
          image: productForm.image || ''
        });
        if (res?.success) {
          addLocalEvent({
            type: 'ProductUpdated',
            productId: editingProductId,
            title: productForm.name,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        const res = await createProductApi({
          name: productForm.name,
          category: productForm.category,
          price: parseFloat(productForm.price) || 0,
          stock: parseInt(productForm.stock, 10) || 0,
          description: productForm.description || '',
          image: productForm.image || ''
        });
        if (res?.success) {
          addLocalEvent({
            type: 'ProductCreated',
            productId: res.data?.id,
            title: productForm.name,
            timestamp: new Date().toISOString()
          });
        }
      }

      setIsProductModalOpen(false);
      fetchAllData();
      toast.success(editingProductId ? 'Product updated successfully!' : 'Product created successfully!');
    } catch (err) {
      const errorDetails = err.details?.errors
        ? Object.entries(err.details.errors)
            .map(([f, msgs]) => `${f}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('; ')
        : '';
      const msg = errorDetails ? `${err.message} (${errorDetails})` : err.message || 'Operation failed';
      setFormError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteProduct = async (id) => {
    const target = products.find((p) => p.id === id);
    if (target && isProductPurchased(target)) {
      toast.error(`"${target.name}" has purchase batches and can't be deleted.`);
      return;
    }
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const res = await deleteProductApi(id);
        if (res?.success) {
          addLocalEvent({
            type: 'ProductDeleted',
            productId: id,
            timestamp: new Date().toISOString()
          });
          toast.success('Product deleted successfully!');
          fetchAllData();
        }
      } catch (err) {
        toast.error(err.message || 'Failed to delete product');
      }
    }
  };

  // Category Handlers
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setCategoryError('');
    if (!categoryForm.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }

    setIsSubmittingCategory(true);
    try {
      const res = await createCategoryApi({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim()
      });
      if (res?.success) {
        addLocalEvent({
          type: 'CategoryCreated',
          name: categoryForm.name.trim(),
          timestamp: new Date().toISOString()
        });
        setIsCategoryModalOpen(false);
        setCategoryForm({ name: '', description: '' });
        fetchAllData();
        toast.success(`Category "${categoryForm.name.trim()}" created successfully!`);
      }
    } catch (err) {
      const msg = err.message || 'Failed to create category';
      setCategoryError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  // Stock Handlers
  const handleOpenAdjustModal = (item, mode = 'replenish') => {
    setAdjustItem(item);
    setAdjustMode(mode);
    setAdjustQty(item.stockQuantity);
    setReplenishAmount('10');
    setAdjustError('');
    setIsAdjustModalOpen(true);
  };

  const handleDeleteInventory = async (productId) => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      try {
        await deleteStockApi(productId);
      } catch (err) {
        console.warn('Backend delete failed, removing locally:', err.message);
      }
      setInventory((prev) => prev.filter((item) => String(item.productId) !== String(productId)));
      toast.success('Inventory item deleted successfully!');
    }
  };

  const handleOpenEditStock = (item) => {
    setEditStockError('');
    setEditStockForm({
      productId: item.productId,
      batchId: item.batchId || item.batch_id || '',
      productName: item.productName || item.product_name || '',
      category: item.category || '',
      stockQuantity: String(item.stockQuantity ?? item.stock_quantity ?? ''),
      expiresAt: item.expiresAt || item.expires_at || '',
      totalSellingPrice: item.totalSellingPrice != null ? String(Number(item.totalSellingPrice)) : ''
    });
    setIsEditStockModalOpen(true);
  };

  const handleSubmitEditStock = async (e) => {
    e.preventDefault();
    setEditStockError('');
    const qty = parseInt(editStockForm.stockQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      setEditStockError('Quantity must be a non-negative number.');
      return;
    }
    const totalSellingPrice = Math.round(parseFloat(editStockForm.totalSellingPrice) * 100) / 100;
    if (!(totalSellingPrice > 0)) {
      setEditStockError('Total selling price must be greater than 0.');
      return;
    }
    if (qty <= 0) {
      setEditStockError('Quantity must be greater than 0 to set a selling price.');
      return;
    }

    setIsSubmittingEditStock(true);
    try {
      // The inventory service derives the unit selling price (total ÷ quantity)
      await updateStockApi(editStockForm.productId, qty, {
        productName: editStockForm.productName,
        category: editStockForm.category,
        batchId: editStockForm.batchId,
        expiresAt: editStockForm.expiresAt || null,
        totalSellingPrice
      });

      addLocalEvent({
        type: 'StockUpdated',
        productId: editStockForm.productId,
        productName: editStockForm.productName,
        quantity: qty,
        batchId: editStockForm.batchId,
        expiresAt: editStockForm.expiresAt,
        timestamp: new Date().toISOString()
      });

      setIsEditStockModalOpen(false);
      fetchAllData();
      toast.success('Inventory stock updated successfully!');
    } catch (err) {
      const msg = err.message || 'Failed to update inventory stock';
      setEditStockError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingEditStock(false);
    }
  };

  // "Add Stock": put a paid purchase batch into inventory.
  // Batches already stocked are marked 'Stocked' on the purchase, so they drop out of this list.
  const stockableBatches = useMemo(
    () =>
      purchases
        .filter((p) => String(p.status || 'Paid').toLowerCase() === 'paid' && p.batchId)
        .sort((a, b) => String(a.batchId).localeCompare(String(b.batchId))),
    [purchases]
  );
  const selectedBatch = stockableBatches.find((p) => p.id === addStockForm.purchaseId) || null;
  const selectedBatchProduct = selectedBatch
    ? products.find((p) => p.name === selectedBatch.productName) || null
    : null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const addStockUnitSellingPrice = (() => {
    const total = parseFloat(addStockForm.totalSellingPrice);
    const qty = parseInt(selectedBatch?.quantity, 10);
    return total > 0 && qty > 0 ? Math.round((total / qty) * 100) / 100 : null;
  })();

  const handleOpenAddStock = () => {
    setAddStockError('');
    setAddStockForm({ purchaseId: stockableBatches[0]?.id || '', expiresAt: '', totalSellingPrice: '' });
    setIsAddStockModalOpen(true);
  };

  const handleSubmitAddStock = async (e) => {
    e.preventDefault();
    setAddStockError('');
    if (!selectedBatch) {
      setAddStockError('Select a batch to add to stock.');
      return;
    }
    if (!selectedBatchProduct) {
      setAddStockError(`"${selectedBatch.productName}" no longer exists in Products & Categories.`);
      return;
    }
    const quantity = parseInt(selectedBatch.quantity, 10);
    if (!(quantity > 0)) {
      setAddStockError('This batch has no quantity to add.');
      return;
    }

    const totalSellingPrice = Math.round(parseFloat(addStockForm.totalSellingPrice) * 100) / 100;
    if (!(totalSellingPrice > 0)) {
      setAddStockError('Total selling price must be greater than 0.');
      return;
    }

    setIsSubmittingAddStock(true);
    try {
      // The inventory service derives the unit selling price (total ÷ quantity)
      await replenishStockApi(selectedBatchProduct.id, quantity, {
        productName: selectedBatchProduct.name,
        category: selectedBatch.category || selectedBatchProduct.category,
        batchId: selectedBatch.batchId,
        expiresAt: addStockForm.expiresAt || undefined,
        totalSellingPrice
      });
      // Mark the batch as stocked so it can't be added twice
      try {
        await updatePurchaseApi(selectedBatch.id, { status: 'Stocked' });
      } catch (statusErr) {
        console.warn('[AdminDashboard] Stock added but purchase status not updated:', statusErr.message);
      }
      addLocalEvent({
        type: 'StockReplenished',
        productId: selectedBatchProduct.id,
        productName: selectedBatchProduct.name,
        batchId: selectedBatch.batchId,
        amountAdded: quantity,
        timestamp: new Date().toISOString()
      });
      setIsAddStockModalOpen(false);
      fetchAllData();
      toast.success(`Batch ${selectedBatch.batchId} added to stock (${quantity} units).`);
    } catch (err) {
      const msg = err.message || 'Could not add stock';
      setAddStockError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingAddStock(false);
    }
  };

  const handleSubmitStockChange = async (e) => {
    e.preventDefault();
    if (!adjustItem) return;
    setAdjustError('');
    setIsSubmittingStock(true);

    try {
      if (adjustMode === 'set') {
        const quantity = parseInt(adjustQty, 10);
        if (isNaN(quantity) || quantity < 0) {
          setAdjustError('Please enter a valid non-negative integer for quantity.');
          setIsSubmittingStock(false);
          return;
        }
        await updateStockApi(adjustItem.productId, quantity, adjustItem.productName);
        addLocalEvent({
          type: 'StockUpdated',
          productId: adjustItem.productId,
          productName: adjustItem.productName,
          quantity,
          timestamp: new Date().toISOString()
        });
      } else {
        const amount = parseInt(replenishAmount, 10);
        if (isNaN(amount) || amount <= 0) {
          setAdjustError('Please enter a positive replenishment amount.');
          setIsSubmittingStock(false);
          return;
        }
        await replenishStockApi(adjustItem.productId, amount);
        addLocalEvent({
          type: 'StockReplenished',
          productId: adjustItem.productId,
          productName: adjustItem.productName,
          amountAdded: amount,
          newStock: Number(adjustItem.stockQuantity) + amount,
          timestamp: new Date().toISOString()
        });
      }

      setIsAdjustModalOpen(false);
      fetchAllData();
      toast.success('Inventory stock updated successfully!');
    } catch (err) {
      const msg = err.message || 'Stock adjustment failed';
      setAdjustError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // Order Handlers
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      addLocalEvent({
        type: 'OrderStatusTransitioned',
        orderId,
        newStatus,
        timestamp: new Date().toISOString()
      });
      toast.success(`Order #${orderId.slice(-6)} updated to ${newStatus}`);
      fetchAllData();
    } catch (err) {
      toast.error(`Failed to update order status: ${err.message}`);
    }
  };

  // Purchase Handlers
  // Purchase form options come only from real data created in Products & Categories
  const purchaseProductOptions = useMemo(
    () =>
      [...new Map(products.filter((p) => p.name).map((p) => [p.name, p])).values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [products]
  );
  const purchaseCategoryOptions = useMemo(
    () =>
      [
        ...new Set([
          ...categories.map((c) => c.name),
          ...products.map((p) => p.category)
        ].filter(Boolean))
      ].sort((a, b) => a.localeCompare(b)),
    [categories, products]
  );

  const handleOpenCreatePurchase = () => {
    setEditingPurchaseId(null);
    setPurchaseFormError('');
    setPurchaseForm({
      batchId: '',
      productName: purchaseProductOptions[0]?.name || '',
      category: purchaseProductOptions[0]?.category || purchaseCategoryOptions[0] || '',
      quantity: '',
      supplier: '',
      totalCost: ''
    });
    setIsPurchaseModalOpen(true);
  };

  const handleOpenEditPurchase = (item) => {
    setEditingPurchaseId(item.id);
    setPurchaseFormError('');
    setPurchaseForm({
      batchId: item.batchId,
      productName: item.productName,
      category: item.category,
      quantity: String(item.quantity || '20'),
      supplier: item.supplier || '',
      totalCost: Number(item.totalCost) > 0 ? String(Number(item.totalCost)) : ''
    });
    setIsPurchaseModalOpen(true);
  };

  const handleDeletePurchase = async (id) => {
    if (window.confirm('Are you sure you want to delete this purchase batch?')) {
      try {
        await deletePurchaseApi(id);
      } catch (err) {
        console.warn('Backend delete failed, removing locally:', err.message);
      }
      const updated = purchases.filter((p) => p.id !== id);
      setPurchases(updated);
      toast.success('Purchase record deleted!');
    }
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForm.productName.trim()) {
      setPurchaseFormError('Product name is required.');
      return;
    }
    const qty = parseInt(purchaseForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setPurchaseFormError('Quantity must be greater than 0.');
      return;
    }
    const totalCost = Math.round(parseFloat(purchaseForm.totalCost) * 100) / 100;
    if (isNaN(totalCost) || totalCost <= 0) {
      setPurchaseFormError('Total purchase cost must be greater than 0.');
      return;
    }
    const unitCost = Math.round((totalCost / qty) * 100) / 100;

    if (editingPurchaseId) {
      try {
        await updatePurchaseApi(editingPurchaseId, {
          productName: purchaseForm.productName,
          category: purchaseForm.category,
          quantity: qty,
          supplier: purchaseForm.supplier,
          unitCost,
          totalCost
        });
      } catch (err) {
        console.warn('Backend update failed:', err.message);
      }
      const updated = purchases.map((p) =>
        p.id === editingPurchaseId
          ? {
              ...p,
              productName: purchaseForm.productName,
              category: purchaseForm.category,
              quantity: qty,
              supplier: purchaseForm.supplier,
              unitCost,
              totalCost
            }
          : p
      );
      setPurchases(updated);
    } else {
      const newPurchase = {
        id: `pur-${Date.now()}`,
        batchId: `BAT-${String(purchases.length + 1).padStart(3, '0')}-2026`,
        productName: purchaseForm.productName,
        category: purchaseForm.category,
        quantity: qty,
        supplier: purchaseForm.supplier,
        unitCost,
        totalCost,
        status: 'Paid'
      };
      try {
        await createPurchaseApi(newPurchase);
      } catch (err) {
        console.warn('Backend create failed:', err.message);
      }
      const updated = [newPurchase, ...purchases];
      setPurchases(updated);
      addLocalEvent({
        type: 'InventoryProcured',
        productName: newPurchase.productName,
        quantity: newPurchase.quantity,
        timestamp: new Date().toISOString()
      });
    }

    setIsPurchaseModalOpen(false);
    fetchAllData();
    toast.success(editingPurchaseId ? 'Purchase batch updated successfully!' : 'Purchase batch recorded successfully!');
  };

  // Available batches aggregated from live inventory and purchases
  const availableBatches = useMemo(() => {
    const list = [];
    const seen = new Set();

    inventory.forEach((item) => {
      const cleanId =
        String(item.productId || '').replace(/\D/g, '') ||
        String(item.productId || '').slice(-3).toUpperCase();
      const bId = item.batchId || item.batch_id || `BAT-${cleanId.padStart(3, '0')}-2026`;
      if (bId && !seen.has(bId)) {
        seen.add(bId);
        const prod = products.find((p) => p.id === item.productId);
        list.push({
          batchId: bId,
          productId: item.productId,
          productName: item.productName || prod?.name || '',
          category: prod?.category || 'Electronics'
        });
      }
    });

    purchases.forEach((p) => {
      if (p.batchId && !seen.has(p.batchId)) {
        seen.add(p.batchId);
        const prod = products.find((pr) => pr.name === p.productName);
        list.push({
          batchId: p.batchId,
          productId: prod?.id || '',
          productName: p.productName,
          category: p.category || prod?.category || 'Electronics'
        });
      }
    });

    if (list.length === 0) {
      list.push({
        batchId: 'BAT-001-2026',
        productId: products[0]?.id || '',
        productName: products[0]?.name || 'Standard Batch',
        category: categories[0]?.name || 'Electronics'
      });
    }

    return list;
  }, [inventory, purchases, products, categories]);

  // Direct Sale Handlers
  const handleOpenCreateSale = () => {
    setSaleFormError('');
    const firstBatch = availableBatches[0];
    const initialProduct = products.find((p) => p.id === firstBatch?.productId) || products[0];
    const initialCategory = initialProduct?.category || firstBatch?.category || categories[0]?.name || 'Electronics';

    setSaleForm({
      batchId: firstBatch?.batchId || 'BAT-001-2026',
      productId: initialProduct?.id || '',
      productName: initialProduct?.name || '',
      category: initialCategory,
      quantity: '1',
      customerName: 'Direct Customer',
      customerEmail: '',
      customerPhone: ''
    });
    setIsSaleModalOpen(true);
  };

  const handleSaleBatchChange = (selectedBatchId) => {
    const match = availableBatches.find((b) => b.batchId === selectedBatchId);
    if (match) {
      const prod = products.find((p) => p.id === match.productId || p.name === match.productName);
      setSaleForm((prev) => ({
        ...prev,
        batchId: selectedBatchId,
        productId: prod?.id || match.productId || prev.productId,
        productName: prod?.name || match.productName || prev.productName,
        category: prod?.category || match.category || prev.category
      }));
    } else {
      setSaleForm((prev) => ({ ...prev, batchId: selectedBatchId }));
    }
  };

  const handleSaleProductChange = (selectedProdId) => {
    const prod = products.find((p) => p.id === selectedProdId);
    const matchingBatch = availableBatches.find((b) => b.productId === selectedProdId || b.productName === prod?.name);
    setSaleForm((prev) => ({
      ...prev,
      productId: selectedProdId,
      productName: prod?.name || prev.productName,
      category: prod?.category || prev.category,
      batchId: matchingBatch ? matchingBatch.batchId : prev.batchId
    }));
  };

  const handleSaleCategoryChange = (selectedCategory) => {
    const prodInCategory = products.find((p) => p.category === selectedCategory);
    setSaleForm((prev) => ({
      ...prev,
      category: selectedCategory,
      productId: prodInCategory ? prodInCategory.id : prev.productId,
      productName: prodInCategory ? prodInCategory.name : prev.productName
    }));
  };

  // Add Sale shows the price the server will charge: the inventory unit selling price
  const saleStockRow = inventory.find((i) => String(i.productId) === String(saleForm.productId)) || null;
  const saleUnitSellingPrice =
    saleStockRow && saleStockRow.unitSellingPrice != null ? Number(saleStockRow.unitSellingPrice) : null;
  const saleQty = parseInt(saleForm.quantity, 10);
  const saleTotalPrice = saleUnitSellingPrice !== null && saleQty > 0 ? saleUnitSellingPrice * saleQty : null;

  const handleSaveSale = async (e) => {
    e.preventDefault();
    setSaleFormError('');

    const qty = parseInt(saleForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setSaleFormError('Quantity must be greater than 0.');
      return;
    }
    const customerEmail = saleForm.customerEmail.trim();
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setSaleFormError('Customer email is not a valid email address.');
      return;
    }
    const selectedProduct = products.find((p) => p.id === saleForm.productId);
    if (!selectedProduct) {
      setSaleFormError('Select a product.');
      return;
    }
    if (saleUnitSellingPrice === null) {
      setSaleFormError('This product has no unit selling price yet. Set it in Inventory (Add Stock or Edit Stock) first.');
      return;
    }

    setIsSubmittingSale(true);
    try {
      // sale-service takes the units from inventory (price = inventory unit selling price),
      // saves the sale and emails the customer a receipt over SMTP
      const res = await createSaleApi({
        batchId: saleForm.batchId || '',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        category: saleForm.category || selectedProduct.category || 'General',
        quantity: qty,
        customerName: saleForm.customerName.trim() || 'Direct Customer',
        customerEmail,
        customerPhone: saleForm.customerPhone.trim()
      });
      const sale = res?.data || {};

      addLocalEvent('DirectSaleCompleted', 'sale-service', {
        saleId: sale.saleId,
        productName: selectedProduct.name,
        quantity: qty,
        totalAmount: sale.totalAmount
      });

      setIsSaleModalOpen(false);
      fetchAllData();

      const amount = `$${(Number(sale.totalAmount) || 0).toFixed(2)}`;
      const note = sale.notification || {};
      if (note.status === 'sent' || note.status === 'queued') {
        toast.success(`Sale ${sale.saleId} recorded — ${amount}`, { description: `A receipt is on its way to ${note.to}` });
      } else if (note.status === 'failed') {
        toast.warning(`Sale ${sale.saleId} recorded — ${amount}`, { description: `Receipt email not sent: ${note.reason}` });
      } else {
        toast.success(`Sale ${sale.saleId} recorded — ${amount}`, { description: 'No customer email given, so no receipt was sent.' });
      }
    } catch (err) {
      setSaleFormError(err.message || 'Failed to record sale transaction.');
      toast.error('Sale not recorded', { description: err.message || 'Failed to record sale transaction.' });
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const filteredPurchases = purchases.filter((item) => {
    const q = purchaseQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.batchId?.toLowerCase().includes(q) ||
      item.productName?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.supplier?.toLowerCase().includes(q);
    const matchesCategory =
      purchaseCategory === 'All' || item.category === purchaseCategory;
    return matchesQuery && matchesCategory;
  });

  // =========================================================================
  // TanStack Table Column Definitions (Powered by @tanstack/react-table)
  // =========================================================================
  // Products with at least one purchase batch are locked (no edit/delete).
  // Purchases reference products by name; product-category-service enforces the same rule.
  const purchasedProductNames = useMemo(
    () => new Set(purchases.map((p) => String(p.productName || '').trim().toLowerCase()).filter(Boolean)),
    [purchases]
  );
  const isProductPurchased = (product) =>
    purchasedProductNames.has(String(product?.name || '').trim().toLowerCase());

  const productColumns = useMemo(
    () => [
      {
        header: 'Product',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="product-cell">
            <div className="table-item-title font-semibold">{row.original.name}</div>
          </div>
        )
      },
      {
        header: 'Category',
        accessorKey: 'category',
        cell: ({ row }) => <span className="cat-tag">{row.original.category}</span>
      },
      {
        header: 'Description',
        accessorKey: 'description',
        cell: ({ row }) => (
          <div style={{ maxWidth: '280px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            <span
              title={row.original.description}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.4'
              }}
            >
              {row.original.description || '—'}
            </span>
          </div>
        )
      },
      {
        header: 'Images',
        id: 'image',
        cell: ({ row }) => (
          <img
            src={
              row.original.image ||
              'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
            }
            alt={row.original.name}
            className="table-thumb"
            style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
          />
        )
      },
      {
        header: 'Action',
        id: 'action',
        cell: ({ row }) => (
          (() => {
            const locked = isProductPurchased(row.original);
            const lockedReason = 'Locked: this product has purchase batches, so it cannot be edited or deleted';
            return (
              <div className="table-actions">
                <button
                  type="button"
                  className="btn-table-edit"
                  onClick={() => handleOpenEditProduct(row.original)}
                  title={locked ? lockedReason : 'Edit Product'}
                  aria-label={locked ? `Edit ${row.original.name} (locked)` : `Edit ${row.original.name}`}
                  disabled={locked}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  className="btn-table-delete"
                  onClick={() => handleDeleteProduct(row.original.id)}
                  title={locked ? lockedReason : 'Delete Product'}
                  aria-label={locked ? `Delete ${row.original.name} (locked)` : `Delete ${row.original.name}`}
                  disabled={locked}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })()
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchasedProductNames]
  );

  // Purchase costs for each inventory row come from the purchase batch it was stocked from
  const purchaseByBatchId = useMemo(
    () => new Map(purchases.filter((p) => p.batchId).map((p) => [String(p.batchId), p])),
    [purchases]
  );

  const inventoryColumns = useMemo(
    () => [
      {
        header: 'Batch ID',
        id: 'batchId',
        cell: ({ row }) => {
          const item = row.original;
          const cleanId =
            String(item.productId || '').replace(/\D/g, '') ||
            String(item.productId || '').slice(-3).toUpperCase();
          const batchId =
            item.batchId || item.batch_id || `BAT-${cleanId.padStart(3, '0')}-2026`;
          return <code className="cat-slug font-mono">{batchId}</code>;
        }
      },
      {
        header: 'Product',
        accessorKey: 'productName',
        cell: ({ row }) => (
          <div className="product-cell">
            <div className="table-item-title font-semibold">{row.original.productName}</div>
          </div>
        )
      },
      {
        header: 'Category',
        id: 'category',
        cell: ({ row }) => {
          const item = row.original;
          const matchedProduct = products.find((p) => String(p.id) === String(item.productId));
          const categoryName = item.category || matchedProduct?.category || 'General';
          return <span className="cat-tag">{categoryName}</span>;
        }
      },
      {
        header: 'Current Stock',
        id: 'currentStock',
        cell: ({ row }) => {
          const item = row.original;
          const qty = Number(item.stockQuantity) || 0;
          const isLow = qty <= effectiveLowStockThreshold && qty > 0;
          const isOut = qty <= 0;
          return (
            <span
              className={`stock-tag ${
                isOut
                  ? 'low font-bold text-red-500'
                  : isLow
                  ? 'low font-bold text-amber'
                  : 'ok font-bold text-emerald'
              }`}
            >
              {qty} units
            </span>
          );
        }
      },
      {
        header: 'Unit Purchase Price',
        id: 'unitPurchasePrice',
        cell: ({ row }) => {
          const purchase = purchaseByBatchId.get(String(row.original.batchId || ''));
          const value = purchase ? Number(purchase.unitCost) : NaN;
          return Number.isFinite(value) && value > 0 ? (
            <span className="font-semibold">${value.toFixed(2)}</span>
          ) : (
            <span className="text-muted" title="No purchase batch recorded for this row">—</span>
          );
        }
      },
      {
        header: 'Total Purchase Cost',
        id: 'totalPurchaseCost',
        cell: ({ row }) => {
          const purchase = purchaseByBatchId.get(String(row.original.batchId || ''));
          const value = purchase ? Number(purchase.totalCost) : NaN;
          return Number.isFinite(value) && value > 0 ? (
            <span className="font-semibold">${value.toFixed(2)}</span>
          ) : (
            <span className="text-muted" title="No purchase batch recorded for this row">—</span>
          );
        }
      },
      {
        header: 'Unit Selling Price',
        id: 'unitSellingPrice',
        cell: ({ row }) => {
          const value = row.original.unitSellingPrice;
          return value == null ? (
            <span className="text-muted">Not set</span>
          ) : (
            <span className="font-semibold">${Number(value).toFixed(2)}</span>
          );
        }
      },
      {
        header: 'Total Selling Price',
        id: 'totalSellingPrice',
        cell: ({ row }) => {
          const value = row.original.totalSellingPrice;
          return value == null ? (
            <span className="text-muted">Not set</span>
          ) : (
            <span className="font-semibold">${Number(value).toFixed(2)}</span>
          );
        }
      },
      {
        header: 'Expires at',
        id: 'expiresAt',
        cell: ({ row }) => {
          const item = row.original;
          const expiresAt = getItemExpiryDate(item);
          const daysLeft = getDaysUntilExpiry(expiresAt);
          const isExpiring = daysLeft <= effectiveExpiryWarningDays;

          return (
            <div className="text-muted text-sm font-mono" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span>{expiresAt}</span>
              {alertSettings.enableExpiryAlerts && (
                daysLeft <= 0 ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', padding: '1px 6px', borderRadius: '4px', width: 'fit-content' }}>
                    Expired
                  </span>
                ) : isExpiring ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: '4px', width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} /> {daysLeft}d left
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {daysLeft}d left
                  </span>
                )
              )}
            </div>
          );
        }
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => {
          const item = row.original;
          const qty = Number(item.stockQuantity) || 0;
          const isLow = qty <= effectiveLowStockThreshold && qty > 0;
          const isOut = qty <= 0;
          const expiresAt = getItemExpiryDate(item);
          const daysLeft = getDaysUntilExpiry(expiresAt);
          const isExpiring = daysLeft <= effectiveExpiryWarningDays;

          if (isOut) {
            return (
              <span className="status-badge cancelled">
                <XCircle size={13} /> Out of Stock
              </span>
            );
          }
          if (isLow && isExpiring) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="status-badge pending" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                  <AlertTriangle size={13} /> Low Stock
                </span>
                <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', fontSize: '0.74rem' }}>
                  <Clock size={11} /> Expiring ({daysLeft}d)
                </span>
              </div>
            );
          }
          if (isLow) {
            return (
              <span className="status-badge pending" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                <AlertTriangle size={13} /> Low Stock
              </span>
            );
          }
          if (isExpiring) {
            return (
              <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}>
                <Clock size={13} /> Expiring Soon ({daysLeft}d)
              </span>
            );
          }
          return (
            <span className="status-badge paid">
              <CheckCircle2 size={13} /> In Stock
            </span>
          );
        }
      },
      {
        header: 'Action',
        id: 'action',
        cell: ({ row }) => (
          <div className="table-actions">
            <button
              type="button"
              className="btn-table-edit"
              onClick={() => handleOpenEditStock(row.original)}
              title="Edit Stock"
              aria-label={`Edit ${row.original.productName}`}
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              className="btn-table-delete"
              onClick={() => handleDeleteInventory(row.original.productId)}
              title="Delete Inventory Item"
              aria-label={`Delete ${row.original.productName}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      }
    ],
    [products, effectiveLowStockThreshold, effectiveExpiryWarningDays, alertSettings, purchaseByBatchId]
  );

  const orderColumns = useMemo(
    () => [
      {
        header: 'Order ID',
        id: 'orderId',
        cell: ({ row }) => <code>#{row.original.orderId || row.original.id}</code>
      },
      {
        header: 'Date',
        id: 'date',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString()
      },
      {
        header: 'Customer Name',
        id: 'customer',
        cell: ({ row }) =>
          row.original.customerName ||
          row.original.shippingAddress?.name ||
          row.original.customerEmail ||
          row.original.customerId
      },
      {
        header: 'Product',
        id: 'orderProducts',
        cell: ({ row }) => (
          <div className="order-item-lines">
            {(row.original.items || []).map((item, idx) => (
              <div key={idx}>
                <span className="font-semibold">{item.quantity}×</span> {item.title || item.name || item.productId}
              </div>
            ))}
          </div>
        )
      },
      {
        header: 'Category',
        id: 'orderCategories',
        cell: ({ row }) => {
          const cats = [...new Set((row.original.items || []).map((i) => i.category).filter(Boolean))];
          return cats.length ? cats.map((c) => <span key={c} className="cat-tag">{c}</span>) : <span className="text-muted">—</span>;
        }
      },
      {
        header: 'Total',
        id: 'total',
        cell: ({ row }) => (
          <span className="font-semibold">
            ${(Number(row.original.totalAmount) || 0).toFixed(2)}
          </span>
        )
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => (
          <span className={`status-badge ${(row.original.status || 'pending').toLowerCase()}`}>
            {row.original.status}
          </span>
        )
      },
      {
        header: '',
        id: 'changeStatus',
        cell: ({ row }) => (
          <select
            className="status-select"
            value={row.original.status}
            onChange={(e) =>
              handleUpdateOrderStatus(row.original.orderId || row.original.id, e.target.value)
            }
          >
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        )
      }
    ],
    []
  );

  const salesColumns = useMemo(
    () => [
      {
        header: 'Sale ID',
        id: 'saleId',
        cell: ({ row }) => <code className="cat-slug font-mono">#{row.original.saleId || row.original.id}</code>
      },
      {
        header: 'Date',
        id: 'date',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString()
      },
      {
        header: 'Customer',
        id: 'customer',
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.customerName || 'Direct Customer'}</div>
            {row.original.customerEmail && <div className="text-muted text-xs">{row.original.customerEmail}</div>}
          </div>
        )
      },
      {
        header: 'Product',
        id: 'product',
        cell: ({ row }) => <span className="font-semibold">{row.original.productName}</span>
      },
      {
        header: 'Category',
        id: 'category',
        cell: ({ row }) => (row.original.category ? <span className="cat-tag">{row.original.category}</span> : '—')
      },
      {
        header: 'Qty',
        id: 'quantity',
        cell: ({ row }) => row.original.quantity
      },
      {
        header: 'Unit Selling Price',
        id: 'unitPrice',
        cell: ({ row }) => `$${(Number(row.original.unitPrice) || 0).toFixed(2)}`
      },
      {
        header: 'Revenue',
        id: 'revenue',
        cell: ({ row }) => (
          <span className="font-semibold">${(Number(row.original.totalAmount) || 0).toFixed(2)}</span>
        )
      },
      {
        header: 'Payment Status',
        id: 'paymentStatus',
        cell: ({ row }) => (
          <span className="status-badge paid">
            <CheckCircle2 size={13} /> {row.original.paymentStatus || 'Paid'}
          </span>
        )
      }
    ],
    []
  );

  const purchaseColumns = useMemo(
    () => [
      {
        header: 'Batch ID',
        accessorKey: 'batchId',
        cell: ({ row }) => <code className="cat-slug font-mono">{row.original.batchId}</code>
      },
      {
        header: 'Product',
        accessorKey: 'productName',
        cell: ({ row }) => (
          <div className="product-cell">
            <div className="table-item-title font-semibold">{row.original.productName}</div>
          </div>
        )
      },
      {
        header: 'Catagory',
        accessorKey: 'category',
        cell: ({ row }) => <span className="cat-tag">{row.original.category}</span>
      },
      {
        header: 'Quantity',
        accessorKey: 'quantity',
        cell: ({ row }) => (
          <span className="font-semibold">
            {Number(row.original.quantity) || 0}
          </span>
        )
      },
      {
        header: 'Total Purchase Cost',
        id: 'totalPurchaseCost',
        accessorKey: 'totalCost',
        cell: ({ row }) => {
          const qty = Number(row.original.quantity) || 0;
          const total = Number(
            row.original.totalCost != null && row.original.totalCost !== ''
              ? row.original.totalCost
              : (qty > 0 && row.original.unitCost != null ? Number(row.original.unitCost) * qty : 0)
          ) || 0;
          return (
            <span className="font-bold text-emerald" style={{ fontSize: '0.96rem' }}>
              ${total.toFixed(2)}
            </span>
          );
        }
      },
      {
        header: 'Unit Purchase Price',
        id: 'unitPurchasePrice',
        accessorKey: 'unitCost',
        cell: ({ row }) => {
          const qty = Number(row.original.quantity) || 0;
          const total = Number(row.original.totalCost) || 0;
          const unit = Number(
            row.original.unitCost != null && row.original.unitCost !== ''
              ? row.original.unitCost
              : (qty > 0 && total > 0 ? total / qty : 0)
          ) || 0;
          return (
            <span style={{ fontSize: '0.92rem' }}>
              ${unit.toFixed(2)}
            </span>
          );
        }
      },
      {
        header: 'supplier name',
        id: 'supplierName',
        accessorKey: 'supplier',
        cell: ({ row }) => <span>{row.original.supplier || row.original.supplierName || '—'}</span>
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => (
          <span className="status-badge paid">
            <CheckCircle2 size={13} /> {row.original.status || 'Paid'}
          </span>
        )
      }
    ],
    []
  );

  const settingsColumns = useMemo(
    () => [
      {
        header: 'lower stock',
        accessorKey: 'lowStockThreshold',
        cell: () =>
          isConfigOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                min="1"
                max="1000"
                value={settingsForm.lowStockThreshold}
                onChange={(e) => setSettingsForm({ ...settingsForm, lowStockThreshold: e.target.value })}
                placeholder="10"
                style={{
                  width: '100px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--primary-color)',
                  background: 'var(--bg-input, var(--bg-card))',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}
                required
              />
              <span className="text-muted text-xs">units</span>
            </div>
          ) : (
            <span className="stock-tag low font-bold text-amber">
              {alertSettings.lowStockThreshold} units
            </span>
          )
      },
      {
        header: 'EXpres Notice',
        accessorKey: 'expiryWarningDays',
        cell: () =>
          isConfigOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                min="1"
                max="365"
                value={settingsForm.expiryWarningDays}
                onChange={(e) => setSettingsForm({ ...settingsForm, expiryWarningDays: e.target.value })}
                placeholder="30"
                style={{
                  width: '100px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--primary-color)',
                  background: 'var(--bg-input, var(--bg-card))',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}
                required
              />
              <span className="text-muted text-xs">days</span>
            </div>
          ) : (
            <span className="text-muted text-sm font-mono" style={{ fontWeight: 600 }}>
              {alertSettings.expiryWarningDays} days
            </span>
          )
      },
      {
        header: 'Action',
        id: 'action',
        cell: () =>
          isConfigOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn-save"
                onClick={handleSaveSettings}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', fontSize: '0.84rem' }}
              >
                <Save size={14} />
                <span>Save</span>
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setSettingsForm(alertSettings);
                  setIsConfigOpen(false);
                }}
                style={{ padding: '6px 12px', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="table-actions">
              <button
                type="button"
                className="btn-table-edit"
                onClick={() => setIsConfigOpen(true)}
                title="Edit Policy"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className="btn-table-delete"
                onClick={handleResetSettings}
                title="Reset / Delete Policy"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
      }
    ],
    [isConfigOpen, settingsForm, alertSettings]
  );

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
              {(lowStockCount > 0 || expiringCount > 0) && (
                <span className="text-amber" title={`${lowStockCount} Low Stock, ${expiringCount} Expiring Soon`}>
                  ⚠️
                </span>
              )}
            </span>
          </button>

          {/* PURCHASE SIDEBAR ITEM */}
          <button
            className={`admin-nav-item ${activeAdminTab === 'purchases' || activeAdminTab === 'purchase' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('purchases')}
          >
            <ShoppingBag size={18} />
            <span>Purchase</span>
            <span className="admin-nav-count">{purchases.length}</span>
          </button>

          <span className="side-section-label">Sales &amp; Fulfillment</span>
          <button
            className={`admin-nav-item ${activeAdminTab === 'sales' || activeAdminTab === 'sale' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('sales')}
          >
            <TrendingUp size={18} />
            <span>Sale</span>
            <span className="admin-nav-count">${totalSalesRevenue.toFixed(0)}</span>
          </button>
          <button
            className={`admin-nav-item ${activeAdminTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('orders')}
          >
            <ShoppingCart size={18} />
            <span>Customer Orders</span>
            <span className="admin-nav-count">{orders.length}</span>
          </button>

          <span className="side-section-label">System &amp; Policy</span>
          {/* POLICY SIDEBAR ITEM */}
          <button
            className={`admin-nav-item ${activeAdminTab === 'policy' || activeAdminTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('policy')}
          >
            <ShieldCheck size={18} />
            <span>Policy</span>
            {(lowStockCount > 0 || expiringCount > 0) && (
              <span
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#d97706',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '10px'
                }}
                title={`${lowStockCount} Low Stock, ${expiringCount} Expiring Soon`}
              >
                {lowStockCount + expiringCount}
              </span>
            )}
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
              {user?.email && <span className="side-user-contact">{user.email}</span>}
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
                    Manage catalog products, pricing, categories, and image assets via <strong>Product &amp; Category Service</strong> (Port 5002).
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
                    <p style={{ color: 'var(--text-muted)' }}>Loading live catalog from Product &amp; Category Service...</p>
                  </div>
                ) : (
                  <TanStackDataTable
                    data={filteredProducts}
                    columns={productColumns}
                    emptyMessage='No products found. Click "Add" to create one in PostgreSQL!'
                    footerText={`Showing ${filteredProducts.length === 0 ? 0 : 1}–${filteredProducts.length} of ${products.length} products`}
                  />
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
                <div className="admin-header-actions">
                  <button
                    type="button"
                    className="btn-admin-action"
                    onClick={handleOpenAddStock}
                    disabled={isLoading}
                  >
                    <Plus size={16} />
                    <span>Add Stock</span>
                  </button>
                </div>
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
                    <option value="low">Low Stock &le; {effectiveLowStockThreshold} units ({lowStockCount})</option>
                    <option value="expiring">Expiring Soon &le; {effectiveExpiryWarningDays} days ({expiringCount})</option>
                    <option value="out">Out of Stock ({outOfStockCount})</option>
                  </select>
                  <span className="admin-filter-total">
                    Showing: <strong>{filteredInventory.length}</strong> of <strong>{inventory.length}</strong> items
                  </span>
                </div>
              </div>

              {/* Inventory TanStack Table */}
              {isLoading ? (
                <div className="admin-table-loading" style={{ textAlign: 'center', padding: '50px' }}>
                  <Loader2 size={36} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)' }}>Connecting to Inventory Service and loading stock ledger...</p>
                </div>
              ) : (
                <TanStackDataTable
                  data={filteredInventory}
                  columns={inventoryColumns}
                  emptyMessage="No inventory items match your search or filter."
                  footerText="Live Inventory Ledger • Verified against inventory_db in PostgreSQL"
                />
              )}
            </div>
          )}

          {/* TAB 3: SALE OVERVIEW */}
          {(activeAdminTab === 'sales' || activeAdminTab === 'sale') && (
            <div className="admin-view-content">
              {/* Header */}
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Sales Overview &amp; Revenue Analytics</h2>
                  <p className="admin-view-sub">
                    Real-time transactional revenue, sales volume, and order settlement performance via <strong>Sale Service</strong> (Port 5005).
                  </p>
                </div>
                <div className="admin-header-actions">
                  <button
                    type="button"
                    className="btn-admin-action"
                    onClick={handleOpenCreateSale}
                  >
                    <Plus size={16} />
                    <span>Add Sale</span>
                  </button>
                </div>
              </div>

              {/* TanStack Table for Sales Ledger */}
              <TanStackDataTable
                data={sales}
                columns={salesColumns}
                emptyMessage='No sales recorded yet. Click "Add Sale" to record one.'
                footerText={`Sales Ledger • ${sales.length} sale(s) • Gross Volume: $${totalSalesRevenue.toFixed(2)}`}
              />
            </div>
          )}

          {/* TAB 4: CUSTOMER ORDERS */}
          {activeAdminTab === 'orders' && (
            <div className="admin-view-content">
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Customer Orders Management</h2>
                  <p className="admin-view-sub">Track order lifecycle and transition statuses.</p>
                </div>
              </div>

              <TanStackDataTable
                data={orders}
                columns={orderColumns}
                emptyMessage="No orders recorded yet. Place an order as a customer to test!"
                footerText={`Total Customer Orders: ${orders.length}`}
              />
            </div>
          )}

          {/* TAB 4: PURCHASE MANAGEMENT */}
          {(activeAdminTab === 'purchases' || activeAdminTab === 'purchase') && (
            <div className="admin-view-content">
              {/* Header */}
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Purchase Management</h2>
                  <p className="admin-view-sub">
                    Track purchase batches, procurement lifecycles, and inbound inventory stock via <strong>Purchase Service</strong> (Port 5003).
                  </p>
                </div>
                <div className="admin-header-actions">
                  <button
                    type="button"
                    className="btn-admin-action"
                    onClick={handleOpenCreatePurchase}
                  >
                    <Plus size={16} />
                    <span>Add Purchase</span>
                  </button>
                </div>
              </div>

              {/* Filter Card */}
              <div className="admin-filter-card">
                <div className="admin-search-field">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by Batch ID, Product, or Catagory..."
                    value={purchaseQuery}
                    onChange={(e) => setPurchaseQuery(e.target.value)}
                  />
                </div>
                <div className="admin-filter-row">
                  <div className="admin-filter-icon">
                    <Filter size={16} />
                  </div>
                  <select
                    value={purchaseCategory}
                    onChange={(e) => setPurchaseCategory(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="admin-filter-total">
                    Total Purchases: <strong>{filteredPurchases.length}</strong>
                  </span>
                </div>
              </div>

              {/* Purchase TanStack Table */}
              <TanStackDataTable
                data={filteredPurchases}
                columns={purchaseColumns}
                emptyMessage="No purchase batches found matching your search."
                footerText={`Showing ${filteredPurchases.length === 0 ? 0 : 1}–${filteredPurchases.length} of ${purchases.length} purchase batches`}
              />
            </div>
          )}

          {/* TAB 5: SYSTEM & ALERT POLICY */}
          {(activeAdminTab === 'policy' || activeAdminTab === 'settings') && (
            <div className="admin-view-content">
              {/* Header */}
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Policy</h2>
                  <p className="admin-view-sub">
                    Configure low stock threshold and expiration notice parameters.
                  </p>
                </div>
                <div className="admin-header-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-table-edit"
                    onClick={() => setIsConfigOpen((prev) => !prev)}
                    title="Edit Policy"
                    style={{ width: '36px', height: '36px', borderRadius: '8px' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-table-delete"
                    onClick={handleResetSettings}
                    title="Reset Policy"
                    style={{ width: '36px', height: '36px', borderRadius: '8px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {settingsSavedMessage && (
                <div
                  className="auth-alert success mb-4"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#15803d',
                    fontWeight: 600
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{settingsSavedMessage}</span>
                </div>
              )}

              {/* TanStack format table form for Alert Settings */}
              <TanStackDataTable
                data={[
                  {
                    id: 'settings-global',
                    lowStockThreshold: alertSettings.lowStockThreshold,
                    expiryWarningDays: alertSettings.expiryWarningDays
                  }
                ]}
                columns={settingsColumns}
              />
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
                <label htmlFor="product-name">Product</label>
                <select
                  id="product-name"
                  value={productForm.name}
                  onChange={(e) => {
                    const selected = e.target.value;
                    const matched = products.find((p) => p.name === selected);
                    const suggested = DEFAULT_PRODUCT_CATALOG.find((p) => p.name === selected);
                    const suggestedCategory =
                      suggested && productCategoryOptions.includes(suggested.category) ? suggested.category : null;
                    setProductForm((prev) => ({
                      ...prev,
                      name: selected,
                      category: matched?.category || suggestedCategory || prev.category,
                      price: matched ? String(matched.price) : prev.price,
                      description: matched?.description || suggested?.description || prev.description,
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
                <label htmlFor="product-category">Category</label>
                <select
                  id="product-category"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  required
                >
                  {productCategoryOptions.map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="product-description">Description</label>
                <textarea
                  id="product-description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Enter product description, specifications, or key features..."
                  rows={3}
                />
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
                                accept="image/*"
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
                        accept="image/*"
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

      {/* Purchase Create/Edit Modal */}
      {isPurchaseModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsPurchaseModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingPurchaseId ? 'Edit Purchase Batch' : 'New Purchase Order'}</h3>

            {purchaseFormError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{purchaseFormError}</span>
              </div>
            )}

            <form onSubmit={handleSavePurchase} className="purchase-modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="purchase-product" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Product</label>
                <select
                  id="purchase-product"
                  value={purchaseForm.productName}
                  onChange={(e) => {
                    const selected = purchaseProductOptions.find((p) => p.name === e.target.value);
                    setPurchaseForm({
                      ...purchaseForm,
                      productName: e.target.value,
                      category: selected?.category || purchaseForm.category
                    });
                  }}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                  required
                >
                  <option value="" disabled>
                    {purchaseProductOptions.length === 0 ? 'No products yet' : '-- Select a Product --'}
                  </option>
                  {purchaseProductOptions.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                  {/* keep an older purchase's product visible when editing */}
                  {purchaseForm.productName &&
                    !purchaseProductOptions.some((p) => p.name === purchaseForm.productName) && (
                      <option value={purchaseForm.productName}>{purchaseForm.productName}</option>
                    )}
                </select>
                {purchaseProductOptions.length === 0 && (
                  <span className="text-muted text-xs">
                    Create a product in <strong>Products &amp; Categories</strong> first.
                  </span>
                )}
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="purchase-category" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Category</label>
                <select
                  id="purchase-category"
                  value={purchaseForm.category}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, category: e.target.value })}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                  required
                >
                  <option value="" disabled>
                    {purchaseCategoryOptions.length === 0 ? 'No categories yet' : '-- Select a Category --'}
                  </option>
                  {purchaseCategoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {purchaseForm.category && !purchaseCategoryOptions.includes(purchaseForm.category) && (
                    <option value={purchaseForm.category}>{purchaseForm.category}</option>
                  )}
                </select>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="20"
                    value={purchaseForm.quantity}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Supplier</label>
                  <input
                    type="text"
                    placeholder="Supplier / Vendor"
                    value={purchaseForm.supplier}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="purchase-total-cost" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Total Purchase Cost</label>
                  <input
                    id="purchase-total-cost"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 1000.00"
                    value={purchaseForm.totalCost}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, totalCost: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="purchase-unit-price" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Unit Purchase Price</label>
                  <input
                    id="purchase-unit-price"
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={purchaseUnitPrice !== null ? purchaseUnitPrice.toFixed(2) : ''}
                    placeholder="Calculated automatically"
                    aria-describedby="purchase-unit-price-hint"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.92rem', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontWeight: 600, cursor: 'default' }}
                  />
                  <span id="purchase-unit-price-hint" className="text-muted text-xs">Total cost ÷ quantity</span>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsPurchaseModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={!editingPurchaseId && purchaseProductOptions.length === 0}
                >
                  {editingPurchaseId ? 'Update Purchase' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Modal (from a paid purchase batch) */}
      {isAddStockModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddStockModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Stock</h3>
            <p className="text-muted text-sm">Move a paid purchase batch into warehouse inventory.</p>

            {addStockError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{addStockError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAddStock} className="admin-form">
              <div className="form-group">
                <label htmlFor="add-stock-batch">Batch ID</label>
                <select
                  id="add-stock-batch"
                  value={addStockForm.purchaseId}
                  onChange={(e) => {
                    setAddStockForm({ ...addStockForm, purchaseId: e.target.value });
                    setAddStockError('');
                  }}
                  required
                >
                  <option value="" disabled>
                    {stockableBatches.length === 0 ? 'No paid batches to stock' : '-- Select a Batch --'}
                  </option>
                  {stockableBatches.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.batchId} — {p.productName} ({p.quantity} units)
                    </option>
                  ))}
                </select>
                {stockableBatches.length === 0 && (
                  <span className="text-muted text-xs">
                    Record a purchase in <strong>Purchase</strong> first. Batches already stocked are not listed.
                  </span>
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="add-stock-product">Product</label>
                  <input id="add-stock-product" type="text" value={selectedBatch?.productName || ''} placeholder="From the batch" readOnly />
                </div>
                <div className="form-group">
                  <label htmlFor="add-stock-category">Category</label>
                  <input id="add-stock-category" type="text" value={selectedBatch?.category || ''} placeholder="From the batch" readOnly />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="add-stock-qty">Quantity</label>
                  <input id="add-stock-qty" type="text" value={selectedBatch ? `${selectedBatch.quantity} units` : ''} placeholder="From the batch" readOnly />
                </div>
                <div className="form-group">
                  <label htmlFor="add-stock-expires">Expires At</label>
                  <input
                    id="add-stock-expires"
                    type="date"
                    min={todayIso}
                    value={addStockForm.expiresAt}
                    onChange={(e) => setAddStockForm({ ...addStockForm, expiresAt: e.target.value })}
                  />
                  <span className="text-muted text-xs">Leave empty if the product doesn't expire.</span>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="add-stock-total-selling">Total Selling Price</label>
                  <input
                    id="add-stock-total-selling"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 1500.00"
                    value={addStockForm.totalSellingPrice}
                    onChange={(e) => setAddStockForm({ ...addStockForm, totalSellingPrice: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="add-stock-unit-selling">Unit Selling Price</label>
                  <input
                    id="add-stock-unit-selling"
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={addStockUnitSellingPrice !== null ? addStockUnitSellingPrice.toFixed(2) : ''}
                    placeholder="Calculated automatically"
                  />
                  <span className="text-muted text-xs">Total selling price ÷ quantity — shown to customers</span>
                </div>
              </div>

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={() => setIsAddStockModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={isSubmittingAddStock || !selectedBatch}>
                  {isSubmittingAddStock ? 'Adding...' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Modal (matches Add Stock layout from screenshot) */}
      {isEditStockModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditStockModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Stock</h3>
            <p className="text-muted text-sm">Update warehouse inventory batch details and stock.</p>

            {editStockError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{editStockError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEditStock} className="admin-form">
              <div className="form-group">
                <label htmlFor="edit-stock-batch">Batch ID</label>
                <input
                  id="edit-stock-batch"
                  type="text"
                  value={editStockForm.batchId}
                  readOnly
                  placeholder="From the batch"
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="edit-stock-product">Product</label>
                  <input
                    id="edit-stock-product"
                    type="text"
                    value={editStockForm.productName}
                    placeholder="From the batch"
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-stock-category">Category</label>
                  <input
                    id="edit-stock-category"
                    type="text"
                    value={editStockForm.category}
                    onChange={(e) => setEditStockForm({ ...editStockForm, category: e.target.value })}
                    placeholder="Category"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="edit-stock-qty">Quantity</label>
                  <input
                    id="edit-stock-qty"
                    type="number"
                    min="0"
                    value={editStockForm.stockQuantity}
                    onChange={(e) => setEditStockForm({ ...editStockForm, stockQuantity: e.target.value })}
                    placeholder="Stock quantity"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-stock-expires">Expires At</label>
                  <input
                    id="edit-stock-expires"
                    type="date"
                    value={editStockForm.expiresAt}
                    onChange={(e) => setEditStockForm({ ...editStockForm, expiresAt: e.target.value })}
                  />
                  <span className="text-muted text-xs">Leave empty if the product doesn't expire.</span>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="edit-stock-total-selling">Total Selling Price</label>
                  <input
                    id="edit-stock-total-selling"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 1500.00"
                    value={editStockForm.totalSellingPrice}
                    onChange={(e) => setEditStockForm({ ...editStockForm, totalSellingPrice: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-stock-unit-selling">Unit Selling Price</label>
                  <input
                    id="edit-stock-unit-selling"
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={editStockUnitSellingPrice !== null ? editStockUnitSellingPrice.toFixed(2) : ''}
                    placeholder="Calculated automatically"
                  />
                  <span className="text-muted text-xs">Total selling price ÷ quantity — shown to customers</span>
                </div>
              </div>

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={() => setIsEditStockModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={isSubmittingEditStock}>
                  {isSubmittingEditStock ? 'Saving...' : 'Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustItem && (
        <div className="modal-backdrop" onClick={() => setIsAdjustModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-with-badge">
              <h3>{adjustMode === 'set' ? 'Set Stock Level' : 'Replenish Inventory'}</h3>
              <p className="text-muted text-sm">{adjustItem.productName} (ID: {adjustItem.productId})</p>
            </div>

            {adjustError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{adjustError}</span>
              </div>
            )}

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

      {/* Sale Create Modal */}
      {isSaleModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSaleModalOpen(false)}>
          <div className="modal-content admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-with-badge">
              <h3>Record Direct Sale</h3>
              <p className="text-muted text-sm">Direct Point-of-Sale transaction registration</p>
            </div>

            {saleFormError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{saleFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSale} className="purchase-modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {/* Batch ID Dropdown */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Batch ID</label>
                <select
                  value={saleForm.batchId}
                  onChange={(e) => handleSaleBatchChange(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                  required
                >
                  <option value="">-- Select Batch ID --</option>
                  {availableBatches.map((b) => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.batchId} {b.productName ? `(${b.productName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product & Category Dropdowns */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Product</label>
                  <select
                    value={saleForm.productId}
                    onChange={(e) => handleSaleProductChange(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                    required
                  >
                    <option value="">-- Select Product --</option>
                    {products.map((p) => {
                      // Price and stock live in Inventory, not on the product record
                      const row = inventory.find((i) => String(i.productId) === String(p.id));
                      const price = row?.unitSellingPrice != null ? `$${Number(row.unitSellingPrice).toFixed(2)}` : 'no price';
                      const left = Number(row?.stockQuantity) || 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} — {price} ({left} in stock)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Category</label>
                  <select
                    value={saleForm.category}
                    onChange={(e) => handleSaleCategoryChange(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                    required
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {categories.length === 0 && (
                      <>
                        <option value="Electronics">Electronics</option>
                        <option value="Audio">Audio</option>
                        <option value="Fitness">Fitness</option>
                        <option value="Accessories">Accessories</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Quantity & Customer Name */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Customer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={saleForm.customerName}
                    onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                    required
                  />
                </div>
              </div>

              {/* Prices (read-only — taken from Inventory) */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="sale-unit-selling" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Unit Selling Price</label>
                  <input
                    id="sale-unit-selling"
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={saleUnitSellingPrice !== null ? `$${saleUnitSellingPrice.toFixed(2)}` : ''}
                    placeholder={saleForm.productId ? 'Not set in Inventory' : 'Select a product'}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.92rem', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontWeight: 600, cursor: 'default' }}
                  />
                  <span className="text-muted text-xs">From Inventory — edit it there</span>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="sale-total-price" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Total</label>
                  <input
                    id="sale-total-price"
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={saleTotalPrice !== null ? `$${saleTotalPrice.toFixed(2)}` : ''}
                    placeholder="Unit selling price × quantity"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.92rem', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontWeight: 600, cursor: 'default' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Customer Email</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={saleForm.customerEmail}
                  onChange={(e) => setSaleForm({ ...saleForm, customerEmail: e.target.value })}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsSaleModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={isSubmittingSale}>
                  {isSubmittingSale ? 'Recording...' : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
