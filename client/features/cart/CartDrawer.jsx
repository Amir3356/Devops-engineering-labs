import { useCart } from '../../context/CartContext';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';

export default function CartDrawer({ isOpen, onClose, onProceedToCheckout }) {
  const { cartItems, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();

  if (!isOpen) return null;

  return (
    <div className="cart-backdrop" onClick={onClose}>
      <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cart-header">
          <div className="cart-header-title">
            <ShoppingBag size={20} />
            <h3>Your Shopping Cart</h3>
            <span className="cart-count-pill">{cartItems.length} items</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="cart-items-container">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBag size={48} className="empty-cart-icon" />
              <h4>Your cart is empty</h4>
              <p>Explore our catalog to add top-tier microservice products!</p>
              <button className="btn-start-shopping" onClick={onClose}>
                Start Shopping
              </button>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="cart-item-card">
                <img src={item.image} alt={item.title} className="cart-item-img" />
                <div className="cart-item-info">
                  <h4 className="cart-item-title">{item.title}</h4>
                  <div className="cart-item-cat">{item.category}</div>
                  <div className="cart-item-price">${item.price.toFixed(2)} each</div>

                  <div className="cart-item-controls">
                    <div className="cart-qty-buttons">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      className="cart-item-remove"
                      onClick={() => removeFromCart(item.id)}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="cart-item-subtotal">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-summary-row">
              <span>Subtotal:</span>
              <span className="cart-subtotal-val">${cartTotal.toFixed(2)}</span>
            </div>
            <div className="cart-summary-row text-muted">
              <span>Shipping:</span>
              <span className="text-emerald-500 font-semibold">FREE</span>
            </div>
            <div className="cart-summary-row total-row">
              <span>Total:</span>
              <span className="cart-grand-total">${cartTotal.toFixed(2)}</span>
            </div>

            <button className="btn-checkout" onClick={onProceedToCheckout}>
              Pay
              <ArrowRight size={18} />
            </button>
            <button className="btn-clear-cart" onClick={clearCart}>
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
