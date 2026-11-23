import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventContext';
import orderService from '../../services/order.service';
import TanStackDataTable from '../../components/TanStackDataTable';
import { Package, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

export default function OrderHistory() {
  const { user } = useAuth();
  const { addLocalEvent } = useEvents();
  const [orders, setOrders] = useState(() => orderService.getStoredOrders());

  useEffect(() => {
    // Load customer orders via order business logic service
    orderService.fetchOrders().then((ords) => {
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

  const columns = useMemo(
    () => [
      {
        header: 'Order ID',
        id: 'orderId',
        cell: ({ row }) => (
          <code className="cat-slug font-mono">
            #{row.original.orderId || row.original.id}
          </code>
        )
      },
      {
        header: 'Date',
        id: 'date',
        cell: ({ row }) => (
          <span className="text-muted text-sm font-mono">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        )
      },
      {
        header: 'Items',
        id: 'items',
        cell: ({ row }) => {
          const items = row.original.items || [];
          if (items.length === 0) return <span className="text-muted text-xs">Standard Item</span>;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {items.slice(0, 2).map((item, idx) => (
                <div key={idx} style={{ fontSize: '0.84rem' }}>
                  <span className="font-semibold">{item.quantity}x</span> {item.title || item.name}
                </div>
              ))}
              {items.length > 2 && (
                <span className="text-muted text-xs">+{items.length - 2} more item(s)</span>
              )}
            </div>
          );
        }
      },
      {
        header: 'Total',
        id: 'total',
        cell: ({ row }) => (
          <span className="font-semibold text-emerald">
            ${(Number(row.original.totalAmount) || 0).toFixed(2)}
          </span>
        )
      },
      {
        header: 'Ship To',
        id: 'shipping',
        cell: ({ row }) => (
          <span className="text-sm text-muted">
            {row.original.shippingAddress?.city
              ? `${row.original.shippingAddress.city}, ${row.original.shippingAddress.country || ''}`
              : 'Standard Delivery'}
          </span>
        )
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => getStatusBadge(row.original.status)
      },
      {
        header: 'Action',
        id: 'action',
        cell: ({ row }) => {
          const order = row.original;
          const canCancel = order.status === 'Paid' || order.status === 'Pending';
          if (!canCancel) {
            return <span className="text-muted text-xs font-mono">—</span>;
          }
          return (
            <button
              type="button"
              className="btn-cancel"
              onClick={() => handleCancelOrder(order.orderId || order.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                fontSize: '0.78rem',
                borderRadius: '6px'
              }}
              title="Cancel Order & Restore Inventory Stock"
            >
              <RotateCcw size={12} />
              <span>Cancel</span>
            </button>
          );
        }
      }
    ],
    []
  );

  return (
    <div className="order-history-view">
      <div className="admin-page-header view-header" style={{ textAlign: 'center' }}>
        <div className="admin-page-heading" style={{ margin: '0 auto', textAlign: 'center' }}>
          <h2 className="admin-view-title">My Order History</h2>
          <p className="admin-view-sub view-sub">Track order lifecycles and observe event-driven state transitions.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-orders-card">
          <Package size={48} className="empty-icon" />
          <h3>No orders placed yet</h3>
          <p>Place an order in the catalog to observe the microservice order workflow!</p>
        </div>
      ) : (
        <TanStackDataTable
          data={orders}
          columns={columns}
          emptyMessage="No orders placed yet."
          footerText={`Total Placed Orders: ${orders.length} • Powered by Order Service (Port 5004)`}
        />
      )}
    </div>
  );
}
