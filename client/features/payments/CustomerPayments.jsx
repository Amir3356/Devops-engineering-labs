import React, { useState } from 'react';
import {
  Wallet,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  ShieldCheck,
  X,
  Receipt,
  Download
} from 'lucide-react';

/**
 * CustomerPayments
 * Citizen / Customer Payment History & Ledger component.
 * Displays payment transactions with column headers and digital receipts.
 */
export default function CustomerPayments({ payments = [] }) {
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const formatDate = (isoStr) => {
    if (!isoStr) return 'Recent';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Success':
      case 'Completed':
        return (
          <span className="pay-status-pill success">
            <CheckCircle size={13} /> Paid
          </span>
        );
      case 'Failed':
      case 'Declined':
        return (
          <span className="pay-status-pill failed">
            <AlertCircle size={13} /> Failed
          </span>
        );
      default:
        return (
          <span className="pay-status-pill pending">
            <Clock size={13} /> {status || 'Pending'}
          </span>
        );
    }
  };

  return (
    <div className="customer-payments-view">
      {/* Header Row */}
      <div className="payments-toolbar-header">
        <div>
          <h2 className="payments-view-title">My Payment History</h2>
          <p className="payments-view-sub">
            Verified ledger of all transactions, digital receipts, and settlement statuses.
          </p>
        </div>
      </div>

      {/* Ledger Table with Column Headers */}
      <div className="payments-table-container">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Transaction / Payment ID</th>
              <th>Order Ref</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date & Time</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {payments && payments.length > 0 ? (
              payments.map((p) => (
                <tr key={p.id || p.paymentId}>
                  <td className="font-mono-cell">
                    <span className="txn-ref-bold">{p.transactionRef || p.id}</span>
                    <span className="pay-sub-id">{p.paymentId || p.id}</span>
                  </td>
                  <td>
                    <span className="order-link-pill">{p.orderId}</span>
                  </td>
                  <td>
                    <div className="pay-method-cell">
                      <Wallet size={15} className="text-primary" />
                      <span>{p.paymentMethod || 'Online Payment'}</span>
                    </div>
                  </td>
                  <td className="pay-amount-cell">
                    ${Number(p.amount).toFixed(2)} {p.currency || 'USD'}
                  </td>
                  <td>{getStatusBadge(p.status)}</td>
                  <td className="pay-date-cell">{formatDate(p.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-view-receipt"
                      onClick={() => setSelectedReceipt(p)}
                      title="View Digital Receipt"
                    >
                      <Receipt size={14} /> Receipt
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="payments-empty-cell">
                  <div className="payments-empty-state-inline">
                    <Receipt size={24} className="text-muted" />
                    <span>No payment records found. Completed transactions and receipts will appear here.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <div className="modal-backdrop" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-content receipt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedReceipt(null)}>
              <X size={20} />
            </button>

            <div className="receipt-box">
              <div className="receipt-header">
                <Receipt size={32} className="text-primary" />
                <h3>Digital Payment Receipt</h3>
                <span className="receipt-tagline">NexusCommerce Transaction Confirmation</span>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-rows">
                <div className="receipt-row">
                  <span className="receipt-label">Payment ID</span>
                  <span className="receipt-val font-mono">{selectedReceipt.id || selectedReceipt.paymentId}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Transaction Ref</span>
                  <span className="receipt-val font-mono">{selectedReceipt.transactionRef}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Associated Order</span>
                  <span className="receipt-val font-mono">{selectedReceipt.orderId}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Payment Method</span>
                  <span className="receipt-val">{selectedReceipt.paymentMethod || 'Online Payment'}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Status</span>
                  <span className="receipt-val">{getStatusBadge(selectedReceipt.status)}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Timestamp</span>
                  <span className="receipt-val">{formatDate(selectedReceipt.createdAt)}</span>
                </div>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-total-row">
                <span>Amount Paid:</span>
                <span className="receipt-total-val">${Number(selectedReceipt.amount).toFixed(2)} USD</span>
              </div>

              <button
                type="button"
                className="btn-done-receipt"
                onClick={() => setSelectedReceipt(null)}
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
