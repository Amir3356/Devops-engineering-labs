const CART_KEY = 'ecommerce_cart';

/**
 * Cart Business Logic Service (Frontend)
 */
class CartService {
  getStoredCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  persistCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  clearStoredCart() {
    localStorage.removeItem(CART_KEY);
  }

  calculateTotals(items) {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 50 || subtotal === 0 ? 0 : 9.99;
    const grandTotal = subtotal + shipping;

    return {
      itemCount,
      subtotal,
      shipping,
      grandTotal
    };
  }

  addItem(currentItems, product, quantity = 1) {
    const existingIndex = currentItems.findIndex(i => i.id === product.id);
    let updated;

    if (existingIndex > -1) {
      updated = currentItems.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.quantity + quantity;
          return { ...item, quantity: newQty };
        }
        return item;
      });
    } else {
      updated = [
        ...currentItems,
        {
          id: product.id,
          title: product.name || product.title,
          price: product.price,
          category: product.category,
          image: product.image,
          quantity
        }
      ];
    }

    this.persistCart(updated);
    return updated;
  }

  updateQuantity(currentItems, productId, newQuantity) {
    if (newQuantity <= 0) {
      return this.removeItem(currentItems, productId);
    }

    const updated = currentItems.map(item =>
      item.id === productId ? { ...item, quantity: newQuantity } : item
    );

    this.persistCart(updated);
    return updated;
  }

  removeItem(currentItems, productId) {
    const updated = currentItems.filter(item => item.id !== productId);
    this.persistCart(updated);
    return updated;
  }
}

export default new CartService();
