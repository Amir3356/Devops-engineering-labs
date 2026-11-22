import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventContext';
import orderService from '../../services/order.service';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, RotateCcw } from 'lucide-react';

export default function OrderHistory() {
  const { user } = useAuth();
  const { addLocalEvent } = useEvents();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Load customer orders via order business logic service
    setOrders(orderService.getStoredOrders());
    orderService.fetchOrders().then(ords => {
      if (ords && ords.length > 0) setOrders(ords);
    });
  }, []);

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;

    const updated = await orderService.cancelOrder(orderId);
    setOrders(updated);

    // Emit OrderCancelled Event (Workflow 6: Order Cancellation)
    addLocalEvent('OrderCancelled', 'order-service', {
      orderId,
      customerId: user?.id || 'guest',
      reason: 'Customer initiated cancellation',
      cancelledAt: new Date().toISOString()
    });

    // Demonstrate Stock Restoration by Inventory Service reaction
    addLocalEvent('StockUpdated', 'inventory-service', {
      orderId,
      action: 'RESTORE_STOCK',
      reason: 'Order cancelled, units returned to inventory pool'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Paid':
        return <span className="status-badge paid"><CheckCircle size={14} /> Paid</span>;
      case 'Shipped':
        return <span className="status-badge shipped"><Package size={14} /> Shipped</span>;
      case 'Delivered':
        return <span className="status-badge delivered"><CheckCircle size={14} /> Delivered</span>;
      case 'Cancelled':
        return <span className="status-badge cancelled"><XCircle size={14} /> Cancelled</span>;
      default:
        return <span className="status-badge pending"><Clock size={14} /> Pending</span>;
    }
  };

  return (
    <div className="order-history-view">
      <div className="view-header">
        <h2>My Order History</h2>
        <p className="view-sub">Track order lifecycles and observe event-driven state transitions.</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-orders-card">
          <Package size={48} className="empty-icon" />
          <h3>No orders placed yet</h3>
          <p>Place an order in the catalog to observe the microservice order workflow!</p>
        </div>
      ) : (
        <div className="order-cards-stack">
          {orders.map((order) => {
            const canCancel = order.status === 'Paid' || order.status === 'Pending';
            return (
              <div key={order.orderId} className="order-card">
                <div className="order-card-header">
                  <div>
                    <span className="order-number">Order #{order.orderId}</span>
                    <span className="order-date">
                      Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="order-header-right">
                    {getStatusBadge(order.status)}
                    <span className="order-total-price">${order.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Tracking Progress Bar */}
                <div className="order-tracking-stepper">
                  <div className={`step-node ${order.status !== 'Cancelled' ? 'active' : 'cancelled'}`}>
                    <div className="step-dot">1</div>
                    <span className="step-label">Order Placed</span>
                  </div>
                  <div className={`step-line ${order.status !== 'Pending' && order.status !== 'Cancelled' ? 'active' : ''}`} />
                  <div className={`step-node ${order.status === 'Paid' || order.status === 'Shipped' || order.status === 'Delivered' ? 'active' : ''}`}>
                    <div className="step-dot">2</div>
                    <span className="step-label">Payment Confirmed</span>
                  </div>
                  <div className={`step-line ${order.status === 'Shipped' || order.status === 'Delivered' ? 'active' : ''}`} />
                  <div className={`step-node ${order.status === 'Shipped' || order.status === 'Delivered' ? 'active' : ''}`}>
                    <div className="step-dot">3</div>
                    <span className="step-label">Shipped</span>
                  </div>
                  <div className={`step-line ${order.status === 'Delivered' ? 'active' : ''}`} />
                  <div className={`step-node ${order.status === 'Delivered' ? 'active' : ''}`}>
                    <div className="step-dot">4</div>
                    <span className="step-label">Delivered</span>
                  </div>
                </div>

                {/* Items in this order */}
                <div className="order-item-list">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="order-item-row">
                      <span>{item.quantity}x {item.title}</span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="order-card-footer">
                  <div className="shipping-to">
                    Ship to: <strong>{order.shippingAddress?.street}, {order.shippingAddress?.city}</strong>
                  </div>

                  {canCancel && (
                    <button
                      className="btn-cancel-order"
                      onClick={() => handleCancelOrder(order.orderId)}
                    >
                      <RotateCcw size={14} /> Cancel Order & Restore Stock
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
