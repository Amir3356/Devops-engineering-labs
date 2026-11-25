import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventContext';
import orderService from '../../services/order.service';
import TanStackDataTable from '../../components/TanStackDataTable';
import { subscribeRealtime } from '../../services/realtime.service';
import { toast } from 'sonner';
import { Package, Clock, CheckCircle, XCircle, RotateCcw, Loader2 } from 'lucide-react';

export default function OrderHistory() {
  const { user } = useAuth();
  const { addLocalEvent } = useEvents();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Orders come only from order-service; refreshed live when any order changes
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      orderService
        .fetchOrders()
        .then((ords) => {
          if (cancelled) return;
          setOrders(ords);
          setLoadError('');
        })
        .catch((err) => {
          if (!cancelled) setLoadError(err.message || 'Could not load your orders');
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

    load();
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === 'orders.updated') load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;

    try {
      setOrders(await orderService.cancelOrder(orderId));
      toast.success('Order cancelled');
    } catch (err) {
      toast.error('Could not cancel the order', { description: err.message });
      return;
    }

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

  const getStatusBadge = (status, reason) => {
    switch (status) {
      case 'Paid':
        return <span className="status-badge paid"><CheckCircle size={14} /> Paid</span>;
      case 'Shipped':
        return <span className="status-badge shipped"><Package size={14} /> Shipped</span>;
      case 'Delivered':
        return <span className="status-badge delivered"><CheckCircle size={14} /> Delivered</span>;
      case 'Cancelled':
        return <span className="status-badge cancelled"><XCircle size={14} /> Cancelled</span>;
      case 'AwaitingStock':
        return <span className="status-badge pending"><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Confirming</span>;
      case 'Rejected':
        return (
          <span className="status-badge cancelled" title={reason || 'Not enough stock'}>
            <XCircle size={14} /> Rejected · refunded
          </span>
        );
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
        header: 'Product',
        id: 'product',
        cell: ({ row }) => {
          const items = row.original.items || [];
          if (items.length === 0) return <span className="text-muted">—</span>;
          return (
            <div className="order-item-lines">
              {items.map((item, idx) => (
                <div key={idx} className="font-semibold">{item.title || item.name || item.productId}</div>
              ))}
            </div>
          );
        }
      },
      {
        header: 'Category',
        id: 'category',
        cell: ({ row }) => {
          const items = row.original.items || [];
          return (
            <div className="order-item-lines">
              {items.map((item, idx) =>
                item.category ? (
                  <div key={idx}><span className="cat-tag">{item.category}</span></div>
                ) : (
                  <div key={idx} className="text-muted">—</div>
                )
              )}
            </div>
          );
        }
      },
      {
        header: 'Qty',
        id: 'qty',
        cell: ({ row }) => (
          <div className="order-item-lines">
            {(row.original.items || []).map((item, idx) => (
              <div key={idx}>{item.quantity}</div>
            ))}
          </div>
        )
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
        cell: ({ row }) => getStatusBadge(row.original.status, row.original.statusReason)
      },
      {
        header: '',
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

      {isLoading ? (
        <div className="empty-orders-card">
          <Loader2 size={32} className="spin-icon" />
          <p>Loading your orders…</p>
        </div>
      ) : loadError ? (
        <div className="empty-orders-card">
          <XCircle size={40} />
          <h3>Couldn't load your orders</h3>
          <p>{loadError}</p>
        </div>
      ) : orders.length === 0 ? (
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
