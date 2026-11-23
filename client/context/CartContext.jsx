import { createContext, useContext, useState, useEffect } from 'react';
import cartService from '../services/cart.service';
import { useEvents } from './EventContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { addLocalEvent } = useEvents();
  const [cartItems, setCartItems] = useState(() => cartService.getStoredCart());
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  useEffect(() => {
    cartService.persistCart(cartItems);
  }, [cartItems]);

  const addToCart = (product, quantity = 1) => {
    const updated = cartService.addItem(cartItems, product, quantity);
    setCartItems(updated);

    addLocalEvent('ProductAddedToCart', 'cart-service', {
      productId: product.id,
      title: product.name || product.title,
      quantity,
      newCartCount: updated.reduce((s, i) => s + i.quantity, 0)
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    const updated = cartService.updateQuantity(cartItems, productId, newQuantity);
    setCartItems(updated);

    addLocalEvent('CartUpdated', 'cart-service', {
      productId,
      quantity: newQuantity,
      totalItems: updated.reduce((s, i) => s + i.quantity, 0)
    });
  };

  const removeFromCart = (productId) => {
    const item = cartItems.find(i => i.id === productId);
    const updated = cartService.removeItem(cartItems, productId);
    setCartItems(updated);

    if (item) {
      addLocalEvent('ProductRemovedFromCart', 'cart-service', {
        productId,
        title: item.title,
        remainingItems: updated.length
      });
    }
  };

  const clearCart = () => {
    cartService.clearStoredCart();
    setCartItems([]);
  };

  const totals = cartService.calculateTotals(cartItems);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      isCartOpen,
      setIsCartOpen,
      openCart,
      closeCart,
      cartCount: totals.itemCount,
      cartTotal: totals.grandTotal,
      subtotal: totals.subtotal,
      shipping: totals.shipping
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
