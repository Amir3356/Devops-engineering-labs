import { pick, toNumber, toInt, toStr, toIsoDate, listOf } from './_fields';

export const LOW_STOCK_THRESHOLD = 5;
export const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {number} price
 * @property {number} stock
 * @property {number} rating
 * @property {string} description
 * @property {string} image
 * @property {string|null} createdAt
 * @property {string|null} updatedAt
 */

/** Build a UI Product from any backend product payload. */
export const createProduct = (raw = {}) => ({
  id: toStr(pick(raw, 'id', 'productId', 'product_id')),
  name: toStr(pick(raw, 'name', 'title', 'productName', 'product_name')),
  category: toStr(pick(raw, 'category', 'categoryName', 'category_name'), 'General'),
  price: toNumber(pick(raw, 'price')),
  stock: toInt(pick(raw, 'stock', 'stockQuantity', 'stock_quantity')),
  rating: toNumber(pick(raw, 'rating'), 5),
  description: toStr(pick(raw, 'description')),
  image: toStr(pick(raw, 'image', 'imageUrl', 'image_url'), DEFAULT_PRODUCT_IMAGE),
  createdAt: toIsoDate(pick(raw, 'createdAt', 'created_at')),
  updatedAt: toIsoDate(pick(raw, 'updatedAt', 'updated_at')),
});

export const createProductList = listOf(createProduct);

/* ---------- Derived values (keep business rules out of components) ---------- */

export const isOutOfStock = (product) => product.stock <= 0;
export const isLowStock = (product, threshold = LOW_STOCK_THRESHOLD) =>
  product.stock > 0 && product.stock <= threshold;

/* ---------- Forms ---------- */

/** Empty values for the create/edit product form (inputs hold strings). */
export const emptyProductForm = (category = '') => ({
  name: '',
  category,
  price: '',
  stock: '',
  description: '',
  image: '',
});

/** Fill the form from an existing product. */
export const productToForm = (product) => ({
  name: product.name,
  category: product.category,
  price: String(product.price),
  stock: String(product.stock),
  description: product.description,
  image: product.image,
});

/** Request body the product service expects for create/update. */
export const productFormToApi = (form) => ({
  name: toStr(form.name),
  category: toStr(form.category),
  price: toNumber(form.price),
  stock: toInt(form.stock),
  description: toStr(form.description),
  image: toStr(form.image) || undefined,
});
