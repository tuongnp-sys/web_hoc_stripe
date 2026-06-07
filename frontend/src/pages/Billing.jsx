import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useStripeMode } from '../context/StripeModeContext';
import RefundRequestModal from '../components/RefundRequestModal';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

const STATUS_LABELS = {
  paid: 'Succeeded',
  pending: 'Pending',
  expired: 'Failed',
  refunded: 'Refunded',
};

const REFUND_STATUS = {
  pending: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  processing: 'Processing refund',
  completed: 'Completed',
};

const BLOCKER_LABELS = {
  missing_STRIPE_SECRET_KEY_LIVE: 'Set STRIPE_SECRET_KEY_LIVE in backend .env',
  missing_STRIPE_WEBHOOK_SECRET_LIVE: 'Set STRIPE_WEBHOOK_SECRET_LIVE and register /webhook/live',
  missing_production_https_domain: 'Set CLIENT_URL to your HTTPS production domain',
  STRIPE_LIVE_ALLOWED_not_enabled: 'Set STRIPE_LIVE_ALLOWED=true when ready for live payments',
};

export default function Billing() {
  const { config: stripeConfig } = useStripeMode();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refundOrder, setRefundOrder] = useState(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const load = () => {
    setLoading(true);
    client
      .get('/api/orders', { params: { limit, offset } })
      .then((res) => {
        setOrders(res.data.orders);
        setTotal(res.data.total);
      })
      .catch(() => setError('Could not load billing history'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    client
      .post('/api/checkout/sync-pending')
      .catch(() => {})
      .finally(() => load());
  }, [offset]);

  const handleDownload = async (orderId) => {
    try {
      const res = await client.get(`/api/invoices/${orderId}/pdf`);
      if (res.data.url) window.open(res.data.url, '_blank');
    } catch (err) {
      setError(err.response?.data?.error || 'Invoice not available');
    }
  };

  if (loading && orders.length === 0) {
    return <div className="container container-wide">Loading…</div>;
  }

  return (
    <div className="container container-wide">
      <h1>Billing History</h1>

      {stripeConfig && !stripeConfig.liveAvailable && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Live mode checklist</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Live payments stay disabled until all items below are complete.
          </p>
          <ul className="hint" style={{ marginBottom: 0 }}>
            {(stripeConfig.liveBlockers || []).map((b) => (
              <li key={b}>{BLOCKER_LABELS[b] || b}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {orders.length === 0 ? (
        <div className="card">
          <p className="hint">No transactions yet. <Link to="/deposit">Add Funds</Link></p>
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <code>{o.shortId}</code>
                  </td>
                  <td>{new Date(o.created_at).toLocaleString()}</td>
                  <td>
                    {o.description || o.product_key}
                    {o.gold_amount > 0 && (
                      <span className="hint"> (+{o.gold_amount} Gold)</span>
                    )}
                  </td>
                  <td className={o.status === 'refunded' ? 'amount-refund' : ''}>
                    {o.status === 'refunded' ? '+' : '-'}
                    {formatMoney(o.amount, o.currency)}
                  </td>
                  <td>
                    <span className={`status-badge status-${o.status}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                    {o.refundRequest && (
                      <span className="hint refund-status">
                        {REFUND_STATUS[o.refundRequest.status]}
                      </span>
                    )}
                  </td>
                  <td className="actions-cell">
                    {o.stripe_invoice_id && o.status === 'paid' && (
                      <button type="button" className="link-btn" onClick={() => handleDownload(o.id)}>
                        Invoice
                      </button>
                    )}
                    {o.refundEligible && (
                      <button type="button" className="link-btn" onClick={() => setRefundOrder(o)}>
                        Request Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="pagination">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          <span className="hint">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </button>
        </div>
      )}

      {refundOrder && (
        <RefundRequestModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSuccess={() => {
            setRefundOrder(null);
            load();
          }}
        />
      )}

      <p className="hint">
        <Link to="/deposit">Add Funds</Link> · <Link to="/account">Account</Link>
      </p>
    </div>
  );
}
