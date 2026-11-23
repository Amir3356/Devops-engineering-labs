import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventContext';
import orderService from '../../services/order.service';
import { processPaymentApi } from '../../api/payment.api';
import { shippingSchema } from '../../utils/validators';
import { X, ShieldCheck, CheckCircle2, Lock, AlertCircle, Loader2, Mail } from 'lucide-react';

export default function CheckoutModal({ isOpen, onClose, onOrderCompleted }) {
  const { cartItems, cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const { addLocalEvent } = useEvents();

  const [step, setStep] = useState('review'); // 'review' | 'paying' | 'success'
  const [paymentStatus, setPaymentStatus] = useState('success'); // 'success' | 'failure' (to test both paths!)
  const [orderResult, setOrderResult] = useState(null);
  const [shippingError, setShippingError] = useState('');

  const [shippingInfo, setShippingInfo] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || 'Addis Ababa',
    zip: user?.address?.zip || '1000'
  });

  if (!isOpen) return null;

  const handlePlaceOrderAndPay = async () => {
    setShippingError('');
    // Zod validation for shipping information
    const validation = shippingSchema.safeParse(shippingInfo);
    if (!validation.success) {
      setShippingError(validation.error.issues[0]?.message || 'Please provide valid shipping details.');
      return;
    }

    setStep('paying');

    // 1. Prepare Order Payload
    const newOrderId = `ord-${Date.now().toString().slice(-6)}`;
    const orderData = {
      orderId: newOrderId,
      customerId: user?.id || null,
      customerEmail: shippingInfo.email,
      items: cartItems.map(item => ({
        productId: item.id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      })),
      totalAmount: cartTotal,
      shippingAddress: shippingInfo,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    // 2. Emit OrderPlaced Event
    addLocalEvent('OrderPlaced', 'order-service', {
      orderId: orderData.orderId,
      customerId: orderData.customerId,
      totalAmount: orderData.totalAmount,
      itemCount: orderData.items.length
    });

    try {
      // 3. Process payment via live Payment Service microservice
      const paymentRes = await processPaymentApi({
        orderId: orderData.orderId,
        amount: orderData.totalAmount,
        paymentMethod: 'Credit Card',
        simulateFailure: paymentStatus === 'failure'
      });

      if (paymentRes && paymentRes.success && paymentRes.data) {
        const paymentRecord = paymentRes.data;

        // Emit PaymentCompleted Event
        addLocalEvent('PaymentCompleted', 'payment-service', paymentRecord);

        // Emit Inventory Stock Update Event (Inventory Service reaction)
        addLocalEvent('StockUpdated', 'inventory-service', {
          orderId: orderData.orderId,
          action: 'DEDUCT',
          items: orderData.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
        });

        // Store order via order business logic service to order-service backend
        await orderService.recordCompletedOrder(orderData, paymentRecord.id || paymentRecord.paymentId);
        setOrderResult({ ...orderData, status: 'Paid', paymentId: paymentRecord.id || paymentRecord.paymentId });
        clearCart();
        setStep('success');
      } else {
        throw new Error(paymentRes?.message || 'Payment processing was not approved');
      }
    } catch (err) {
      // Emit PaymentFailed Event
      addLocalEvent('PaymentFailed', 'payment-service', {
        orderId: orderData.orderId,
        amount: orderData.totalAmount,
        reason: err.message || 'Card payment declined'
      });
      setStep('failed');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content checkout-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {step === 'review' && (
          <div className="checkout-content">
            <h2 className="checkout-title">Checkout & Payment Gateway</h2>
            <p className="checkout-sub">
              Directly processed via <strong>Payment Service</strong> and persisted in <strong>Order Service</strong>.
            </p>

            <div className="checkout-grid">
              {/* Shipping Address */}
              <div className="checkout-col">
                <h4 className="section-subtitle">1. Shipping Address</h4>

                {shippingError && (
                  <div className="auth-alert error mb-3">
                    <AlertCircle size={16} />
                    <span>{shippingError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label>Recipient Name</label>
                  <input
                    type="text"
                    value={shippingInfo.name}
                    onChange={(e) => {
                      setShippingInfo({ ...shippingInfo, name: e.target.value });
                      setShippingError('');
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={16} />
                    <input
                      type="email"
                      value={shippingInfo.email}
                      onChange={(e) => {
                        setShippingInfo({ ...shippingInfo, email: e.target.value });
                        setShippingError('');
                      }}
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={shippingInfo.street}
                    onChange={(e) => {
                      setShippingInfo({ ...shippingInfo, street: e.target.value });
                      setShippingError('');
                    }}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>City</label>
                    <input
                      type="text"
                      value={shippingInfo.city}
                      onChange={(e) => {
                        setShippingInfo({ ...shippingInfo, city: e.target.value });
                        setShippingError('');
                      }}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>State</label>
                    <input
                      type="text"
                      value={shippingInfo.state}
                      onChange={(e) => {
                        setShippingInfo({ ...shippingInfo, state: e.target.value });
                        setShippingError('');
                      }}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      value={shippingInfo.zip}
                      onChange={(e) => {
                        setShippingInfo({ ...shippingInfo, zip: e.target.value });
                        setShippingError('');
                      }}
                    />
                  </div>
                </div>

                {/* Payment Option */}
                <h4 className="section-subtitle mt-4">2. Payment Gateway Mode</h4>
                <div className="payment-simulation-toggle">
                  <label className={`sim-radio ${paymentStatus === 'success' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentSim"
                      value="success"
                      checked={paymentStatus === 'success'}
                      onChange={() => setPaymentStatus('success')}
                    />
                    <span>💳 Credit Card / Online Payment (Approved)</span>
                  </label>
                  <label className={`sim-radio ${paymentStatus === 'failure' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentSim"
                      value="failure"
                      checked={paymentStatus === 'failure'}
                      onChange={() => setPaymentStatus('failure')}
                    />
                    <span>⚠️ Test Card Decline (Simulate Failure)</span>
                  </label>
                </div>
              </div>

              {/* Order Summary */}
              <div className="checkout-col summary-col">
                <h4 className="section-subtitle">Order Summary</h4>
                <div className="checkout-item-list">
                  {cartItems.map((item) => (
                    <div key={item.id} className="checkout-summary-item">
                      <span>{item.quantity}x {item.title}</span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="checkout-total-box">
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Shipping:</span>
                    <span className="text-emerald-500">Free</span>
                  </div>
                  <div className="summary-row total-highlight">
                    <span>Total Due:</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button className="btn-pay-now" onClick={handlePlaceOrderAndPay}>
                  <Lock size={16} /> Pay ${cartTotal.toFixed(2)}
                </button>
                <div className="secure-badge">
                  <ShieldCheck size={14} /> 256-bit Encrypted Microservices Sandbox
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'paying' && (
          <div className="payment-loading-state">
            <Loader2 size={48} className="spinner" />
            <h3>Processing Payment via Payment Service...</h3>
            <p>Publishing <code>OrderPlaced</code> and evaluating payment simulation...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="payment-result-state success">
            <CheckCircle2 size={56} className="text-emerald-500" />
            <h2>Payment Completed Successfully!</h2>
            <p>
              Order <strong>#{orderResult?.orderId}</strong> has been registered in Order Service.
            </p>
            <div className="event-reaction-callout">
              <h4>Events Emitted & Handled:</h4>
              <ul>
                <li>⚡ <code>OrderPlaced</code> emitted by <em>order-service</em></li>
                <li>⚡ <code>PaymentCompleted</code> emitted by <em>payment-service</em></li>
                <li>⚡ <code>StockUpdated</code> emitted by <em>inventory-service</em></li>
              </ul>
            </div>
            <button
              className="btn-finish-order"
              onClick={() => {
                onClose();
                if (onOrderCompleted) onOrderCompleted(orderResult);
              }}
            >
              View in My Orders
            </button>
          </div>
        )}

        {step === 'failed' && (
          <div className="payment-result-state failure">
            <AlertCircle size={56} className="text-red-500" />
            <h2>Payment Simulation Declined</h2>
            <p>The simulated payment gateway returned a transaction failure.</p>
            <div className="event-reaction-callout">
              <h4>Event Emitted:</h4>
              <p>⚡ <code>PaymentFailed</code> emitted by <em>payment-service</em></p>
            </div>
            <button className="btn-retry-payment" onClick={() => setStep('review')}>
              Try Again with Successful Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
