import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import TanStackDataTable from '../../components/TanStackDataTable';
import { useEvents } from '../../context/EventContext';
import { useAuth } from '../../context/AuthContext';
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
  Clock,
  Save,
  RotateCcw,
  Sliders,
  TrendingUp,
  DollarSign
} from 'lucide-react';

const DEFAULT_PRODUCT_OPTIONS = [];

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
  const [isAddStockFlow, setIsAddStockFlow] = useState(false); // opened from the "Add Stock" header button

  // Purchase State & Filter
  const [purchases, setPurchases] = useState(() => {
    const saved = localStorage.getItem('nexus_admin_purchases');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return [];
  });
  const [purchaseQuery, setPurchaseQuery] = useState('');
  const [purchaseCategory, setPurchaseCategory] = useState('All');
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [purchaseFormError, setPurchaseFormError] = useState('');
  const [purchaseForm, setPurchaseForm] = useState({
    batchId: '',
    productName: '',
    category: 'Electronics',
    quantity: '20',
    supplier: ''
  });

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

  // Fetch all live microservices data
  const fetchAllData = () => {
    return Promise.allSettled([
      getProductsApi(),
      getCategoriesApi(),
      getAllStockApi(),
      orderService.fetchAllAdminOrders(),
      getPurchasesApi()
    ]).then(([prodRes, catRes, invRes, ordsRes, purchRes]) => {
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
        if (purchRes.value.data.length > 0) {
          setPurchases(purchRes.value.data);
          localStorage.setItem('nexus_admin_purchases', JSON.stringify(purchRes.value.data));
        }
      }
    });
  };

  useEffect(() => {
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
  const totalSalesRevenue = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [orders]);

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

  const handleSaveSettings = (e) => {
    if (e) e.preventDefault();
    const updated = {
      lowStockThreshold: Math.max(1, parseInt(settingsForm.lowStockThreshold, 10) || 5),
      expiryWarningDays: Math.max(1, parseInt(settingsForm.expiryWarningDays, 10) || 15),
      enableLowStockAlerts: true,
      enableExpiryAlerts: true,
      highlightOutOfStock: true
    };
    setAlertSettings(updated);
    setSettingsForm(updated);
    localStorage.setItem('nexus_inventory_alert_settings', JSON.stringify(updated));
    setSettingsSavedMessage('Alert configuration saved successfully!');
    toast.success('Alert configuration saved successfully!');
    setIsConfigOpen(false);
    setTimeout(() => setSettingsSavedMessage(''), 4500);
  };

  const handleResetSettings = () => {
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
      name: productDropdownOptions[0] || '',
      category: categories[0]?.name || '',
      price: '',
      stock: '0',
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
      price: parseFloat(productForm.price),
      stock: parseInt(productForm.stock, 10),
      description: productForm.description
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
          price: parseFloat(productForm.price),
          stock: parseInt(productForm.stock, 10),
          description: productForm.description,
          image: productForm.image
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
          price: parseFloat(productForm.price),
          stock: parseInt(productForm.stock, 10),
          description: productForm.description,
          image: productForm.image
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
      const msg = err.message || 'Operation failed';
      setFormError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteProduct = async (id) => {
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
  const handleOpenAdjustModal = (item, mode = 'replenish', pickProduct = false) => {
    setIsAddStockFlow(pickProduct);
    setAdjustItem(item);
    setAdjustMode(mode);
    setAdjustQty(item.stockQuantity);
    setReplenishAmount('10');
    setAdjustError('');
    setIsAdjustModalOpen(true);
  };

  // "Add Stock" header button: pick any catalog product and add units to it.
  // Products without an inventory row yet get one created on save.
  const addStockOptions = useMemo(() => {
    const byId = new Map();
    inventory.forEach((i) => {
      byId.set(String(i.productId), {
        productId: i.productId,
        productName: i.productName || i.productId,
        stockQuantity: Number(i.stockQuantity) || 0,
        hasInventoryRow: true
      });
    });
    products.forEach((p) => {
      if (!byId.has(String(p.id))) {
        byId.set(String(p.id), {
          productId: p.id,
          productName: p.name,
          stockQuantity: 0,
          hasInventoryRow: false
        });
      }
    });
    return [...byId.values()].sort((a, b) => String(a.productName).localeCompare(String(b.productName)));
  }, [inventory, products]);

  const handleOpenAddStock = () => {
    if (addStockOptions.length === 0) {
      toast.error('Create a product first — there is nothing to add stock to yet.');
      return;
    }
    handleOpenAdjustModal(addStockOptions[0], 'replenish', true);
  };

  const handleSelectAddStockProduct = (productId) => {
    const option = addStockOptions.find((o) => String(o.productId) === String(productId));
    if (option) {
      setAdjustItem(option);
      setAdjustError('');
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
        if (isAddStockFlow && !adjustItem.hasInventoryRow) {
          // No inventory row yet: create it with the added amount
          await updateStockApi(adjustItem.productId, amount, adjustItem.productName);
        } else {
          await replenishStockApi(adjustItem.productId, amount);
        }
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
  const handleOpenCreatePurchase = () => {
    setEditingPurchaseId(null);
    setPurchaseFormError('');
    setPurchaseForm({
      batchId: '',
      productName: productDropdownOptions[0] || '',
      category: categories[0]?.name || '',
      quantity: '',
      supplier: ''
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
      supplier: item.supplier || ''
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
      localStorage.setItem('nexus_admin_purchases', JSON.stringify(updated));
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

    if (editingPurchaseId) {
      try {
        await updatePurchaseApi(editingPurchaseId, {
          productName: purchaseForm.productName,
          category: purchaseForm.category,
          quantity: qty,
          supplier: purchaseForm.supplier
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
              supplier: purchaseForm.supplier
            }
          : p
      );
      setPurchases(updated);
      localStorage.setItem('nexus_admin_purchases', JSON.stringify(updated));
    } else {
      const newPurchase = {
        id: `pur-${Date.now()}`,
        batchId: `BAT-${String(purchases.length + 1).padStart(3, '0')}-2026`,
        productName: purchaseForm.productName,
        category: purchaseForm.category,
        quantity: qty,
        supplier: purchaseForm.supplier
      };
      try {
        await createPurchaseApi(newPurchase);
      } catch (err) {
        console.warn('Backend create failed:', err.message);
      }
      const updated = [newPurchase, ...purchases];
      setPurchases(updated);
      localStorage.setItem('nexus_admin_purchases', JSON.stringify(updated));
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

  const handleSaveSale = async (e) => {
    e.preventDefault();
    setSaleFormError('');

    const qty = parseInt(saleForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setSaleFormError('Quantity must be greater than 0.');
      return;
    }

    const selectedProduct = products.find((p) => p.id === saleForm.productId) || products[0];
    const unitPrice = selectedProduct ? Number(selectedProduct.price) : 0;
    const totalAmount = unitPrice * qty;
    const orderId = `ord-${Date.now().toString().slice(-6)}`;

    setIsSubmittingSale(true);
    try {
      const orderPayload = {
        orderId,
        batchId: saleForm.batchId || 'BAT-001-2026',
        category: saleForm.category || selectedProduct?.category || 'General',
        customerName: saleForm.customerName.trim() || 'Direct Customer',
        customerEmail: saleForm.customerEmail.trim() || 'direct@example.com',
        customerPhone: saleForm.customerPhone.trim() || 'N/A',
        items: [
          {
            productId: selectedProduct ? selectedProduct.id : `prod-${Date.now()}`,
            title: selectedProduct ? selectedProduct.name : saleForm.productName || 'Direct Sale Item',
            batchId: saleForm.batchId || 'BAT-001-2026',
            category: saleForm.category || selectedProduct?.category || 'General',
            price: unitPrice,
            quantity: qty,
            subtotal: totalAmount
          }
        ],
        totalAmount,
        status: 'Delivered',
        paymentStatus: 'Paid',
        createdAt: new Date().toISOString()
      };

      await orderService.recordCompletedOrder(orderPayload, `pay-${Date.now().toString().slice(-6)}`);

      // Persist to Sale Service (Port 5005)
      try {
        await createSaleApi({
          saleId: orderId,
          batchId: saleForm.batchId || 'BAT-001-2026',
          productId: selectedProduct ? selectedProduct.id : `prod-${Date.now()}`,
          productName: selectedProduct ? selectedProduct.name : saleForm.productName || 'Direct Sale Item',
          category: saleForm.category || selectedProduct?.category || 'General',
          quantity: qty,
          unitPrice,
          totalAmount,
          customerName: orderPayload.customerName,
          customerEmail: orderPayload.customerEmail,
          customerPhone: orderPayload.customerPhone
        });
      } catch (saleErr) {
        console.warn('[AdminDashboard] Backend sale-service record failed:', saleErr.message);
      }

      if (selectedProduct?.id) {
        try {
          await replenishStockApi(selectedProduct.id, -qty);
        } catch (stockErr) {
          console.warn('[AdminDashboard] Could not update stock on direct sale:', stockErr);
        }
      }

      addLocalEvent('DirectSaleCompleted', 'order-service', {
        orderId,
        batchId: saleForm.batchId,
        category: saleForm.category,
        customerName: orderPayload.customerName,
        totalAmount,
        itemsCount: qty
      });

      toast.success(`Direct Sale #${orderId} of $${totalAmount.toFixed(2)} recorded!`);
      setIsSaleModalOpen(false);
      fetchAllData();
    } catch (err) {
      setSaleFormError(err.message || 'Failed to record sale transaction.');
      toast.error(err.message || 'Failed to record sale transaction.');
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
          <div className="table-actions">
            <button
              type="button"
              className="btn-table-edit"
              onClick={() => handleOpenEditProduct(row.original)}
              title="Edit Product"
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              className="btn-table-delete"
              onClick={() => handleDeleteProduct(row.original.id)}
              title="Delete Product"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      }
    ],
    []
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
      }
    ],
    [products, effectiveLowStockThreshold, effectiveExpiryWarningDays, alertSettings]
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
        header: 'Change Status',
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
        header: 'Transaction ID',
        id: 'saleId',
        cell: ({ row }) => (
          <code style={{ fontWeight: 700, color: 'var(--primary-color)' }}>
            #{row.original.orderId || row.original.id}
          </code>
        )
      },
      {
        header: 'Date',
        id: 'saleDate',
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
        header: 'Items',
        id: 'itemsSold',
        cell: ({ row }) => {
          const items = Array.isArray(row.original.items) ? row.original.items : [];
          const count = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
          return (
            <span style={{ fontSize: '0.88rem' }}>
              <strong>{count}</strong> {count === 1 ? 'unit' : 'units'}
            </span>
          );
        }
      },
      {
        header: 'Revenue',
        id: 'saleAmount',
        cell: ({ row }) => (
          <span className="font-bold text-emerald" style={{ fontSize: '0.96rem' }}>
            ${(Number(row.original.totalAmount) || 0).toFixed(2)}
          </span>
        )
      },
      {
        header: 'Payment Status',
        id: 'payStatus',
        cell: ({ row }) => (
          <span className="status-badge paid">
            <CheckCircle2 size={13} /> {row.original.paymentStatus || 'Paid'}
          </span>
        )
      },
      {
        header: 'Fulfillment',
        id: 'fulfillmentStatus',
        cell: ({ row }) => (
          <span className={`status-badge ${(row.original.status || 'pending').toLowerCase()}`}>
            {row.original.status || 'Pending'}
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
            {row.original.supplier && (
              <div className="text-xs text-muted" style={{ fontSize: '0.78rem' }}>
                Supplier: {row.original.supplier}
              </div>
            )}
          </div>
        )
      },
      {
        header: 'Catagory',
        accessorKey: 'category',
        cell: ({ row }) => <span className="cat-tag">{row.original.category}</span>
      },
      {
        header: 'Action',
        id: 'action',
        cell: ({ row }) => (
          <div className="table-actions">
            <button
              type="button"
              className="btn-table-edit"
              onClick={() => handleOpenEditPurchase(row.original)}
              title="Edit Purchase"
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              className="btn-table-delete"
              onClick={() => handleDeletePurchase(row.original.id)}
              title="Delete Purchase"
            >
              <Trash2 size={14} />
            </button>
          </div>
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
                title="Edit Settings"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className="btn-table-delete"
                onClick={handleResetSettings}
                title="Reset / Delete Settings"
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

          <span className="side-section-label">System &amp; Settings</span>
          {/* SETTINGS SIDEBAR ITEM */}
          <button
            className={`admin-nav-item ${activeAdminTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveAdminTab('settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
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
                data={orders}
                columns={salesColumns}
                emptyMessage="No sales transactions recorded yet. Place customer orders to generate sales records."
                footerText={`Sales Ledger • ${orders.length} Total Transaction(s) • Gross Volume: $${totalSalesRevenue.toFixed(2)}`}
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

          {/* TAB 5: SYSTEM & ALERT SETTINGS */}
          {activeAdminTab === 'settings' && (
            <div className="admin-view-content">
              {/* Header */}
              <div className="admin-page-header">
                <div className="admin-page-heading">
                  <h2 className="admin-view-title">Settings</h2>
                  <p className="admin-view-sub">
                    Configure low stock threshold and expiration notice parameters.
                  </p>
                </div>
                <div className="admin-header-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-table-edit"
                    onClick={() => setIsConfigOpen((prev) => !prev)}
                    title="Edit Settings"
                    style={{ width: '36px', height: '36px', borderRadius: '8px' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-table-delete"
                    onClick={handleResetSettings}
                    title="Reset Settings"
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
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Product</label>
                <input
                  type="text"
                  list="purchase-product-options"
                  placeholder="Select or enter product name"
                  value={purchaseForm.productName}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, productName: e.target.value })}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                  required
                />
                <datalist id="purchase-product-options">
                  {productDropdownOptions.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>Catagory</label>
                <select
                  value={purchaseForm.category}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, category: e.target.value })}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}
                  required
                >
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

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsPurchaseModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {editingPurchaseId ? 'Update Purchase' : 'Save Purchase'}
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
              <h3>{adjustMode === 'set' ? 'Set Stock Level' : isAddStockFlow ? 'Add Stock' : 'Replenish Inventory'}</h3>
              {!isAddStockFlow && (
                <p className="text-muted text-sm">{adjustItem.productName} (ID: {adjustItem.productId})</p>
              )}
            </div>

            {adjustError && (
              <div className="auth-alert error mb-3">
                <AlertTriangle size={16} />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitStockChange} className="admin-form">
              {isAddStockFlow && (
                <div className="form-group">
                  <label htmlFor="add-stock-product">Product</label>
                  <select
                    id="add-stock-product"
                    value={adjustItem.productId}
                    onChange={(e) => handleSelectAddStockProduct(e.target.value)}
                    required
                  >
                    {addStockOptions.map((item) => (
                      <option key={item.productId} value={item.productId}>
                        {item.productName} — {item.hasInventoryRow ? `${item.stockQuantity} in stock` : 'not stocked yet'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  <label>{isAddStockFlow ? 'Quantity to Add' : 'Units to Add (Replenish)'}</label>
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
                  {isSubmittingStock ? 'Saving...' : adjustMode === 'set' ? 'Update Stock Count' : isAddStockFlow ? 'Add Stock' : 'Replenish Inventory'}
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
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${Number(p.price).toFixed(2)} ({p.stock} in stock)
                      </option>
                    ))}
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
