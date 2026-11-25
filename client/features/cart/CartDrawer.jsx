import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import orderService, { AWAITING_STOCK } from '../../services/order.service';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, Loader2 } from 'lucide-react';

export default function CartDrawer({ isOpen, onClose }) {
  const { cartItems, updateQuantity, removeFromCart, cartTotal, subtotal, shipping, clearCart } = useCart();
  const { user } = useAuth();
  const [isPaying, setIsPaying] = useState(false);
  // Idempotency key for this checkout attempt: a retry after a network error reuses it, so the
  // server returns the order it may already have created instead of charging twice
  const checkoutKeyRef = useRef(null);
  useEffect(() => {
    checkoutKeyRef.current = null; // the cart changed, so the next pay is a new checkout
  }, [cartItems]);

  if (!isOpen) return null;

  // One tap: the order is paid and saved straight away (no checkout form).
  // Inventory then reserves the units asynchronously (order saga) or rejects the order.
  const handlePay = async () => {
    if (isPaying || cartItems.length === 0) return;
    setIsPaying(true);
    const total = Math.round(cartTotal * 100) / 100;
    if (!checkoutKeyRef.current) checkoutKeyRef.current = crypto.randomUUID();
    try {
      const saved = await orderService.recordCompletedOrder({
        idempotencyKey: checkoutKeyRef.current,
        customerId: user?.id || null,
        customerName: user?.name || undefined,
        customerEmail: user?.email || undefined,
        items: cartItems.map((item) => ({
          productId: item.id,
          title: item.title,
          category: item.category || '',
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount: total,
        // No address form any more: deliver to the account holder
        shippingAddress: { name: user?.name || '', email: user?.email || '' }
      });
      checkoutKeyRef.current = null;
      clearCart();
      onClose();
      const shortId = String(saved?.id || '').slice(-8);
      if (saved?.status === AWAITING_STOCK) {
        // Accepted, but inventory hasn't answered yet (e.g. it is restarting); it will
        toast.info('Payment received', {
          description: `Order #${shortId} is being confirmed. Watch its status in My Orders.`
        });
        return;
      }
      const receipt = saved?.notification?.status === 'queued'
        ? ` A receipt is on its way to ${saved.notification.to}.`
        : '';
      toast.success('Payment successful', {
        description: `Order #${shortId} is paid — $${total.toFixed(2)}.${receipt} Track it in My Orders.`
      });
    } catch (err) {
      if (err.code === 'SOLD_OUT') {
        // Definitive answer (another customer got the last units): next attempt is a new checkout
        checkoutKeyRef.current = null;
        toast.error('Sold out during checkout', { description: err.message });
        return;
      }
      toast.error('Payment failed', { description: err.message || 'The order could not be placed' });
    } finally {
      setIsPaying(false);
    }
  };

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
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={Number.isFinite(Number(item.stock)) && item.quantity >= Number(item.stock)}
                        title={Number.isFinite(Number(item.stock)) && item.quantity >= Number(item.stock) ? `Only ${item.stock} in stock` : undefined}
                      >
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
              <span className="cart-subtotal-val">${subtotal.toFixed(2)}</span>
            </div>
            <div className="cart-summary-row text-muted">
              <span>Shipping:</span>
              {shipping === 0 ? (
                <span className="text-emerald-500 font-semibold">FREE</span>
              ) : (
                <span>${shipping.toFixed(2)}</span>
              )}
            </div>
            {shipping > 0 && (
              <div className="cart-summary-row text-muted cart-free-shipping-hint">
                <span>Add ${(50 - subtotal).toFixed(2)} more for free shipping</span>
              </div>
            )}
            <div className="cart-summary-row total-row">
              <span>Total:</span>
              <span className="cart-grand-total">${cartTotal.toFixed(2)}</span>
            </div>

            <button className="btn-checkout" onClick={handlePay} disabled={isPaying}>
              {isPaying ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  Paying…
                </>
              ) : (
                <>
                  Pay ${cartTotal.toFixed(2)}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <button className="btn-clear-cart" onClick={clearCart} disabled={isPaying}>
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
