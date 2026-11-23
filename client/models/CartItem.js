import { pick, toNumber, toInt, toStr } from './_fields';

/**
 * @typedef {Object} CartItem
 * @property {string} id        Product id
 * @property {string} title     Product name, as shown in the cart
 * @property {number} price
 * @property {string} category
 * @property {string} image
 * @property {number} quantity
 */

/** Normalise a stored/served cart line. */
export const createCartItem = (raw = {}) => ({
  id: toStr(pick(raw, 'id', 'productId', 'product_id')),
  title: toStr(pick(raw, 'title', 'name', 'productName')),
  price: toNumber(pick(raw, 'price')),
  category: toStr(pick(raw, 'category')),
  image: toStr(pick(raw, 'image')),
  quantity: Math.max(1, toInt(pick(raw, 'quantity'), 1)),
});

/** Turn a Product into a cart line. */
export const cartItemFromProduct = (product, quantity = 1) =>
  createCartItem({ ...product, title: product.name, quantity });

export const lineTotal = (item) => item.price * item.quantity;

export const cartTotals = (items = []) => ({
  itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal: items.reduce((sum, i) => sum + lineTotal(i), 0),
});
