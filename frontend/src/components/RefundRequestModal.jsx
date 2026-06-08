import { useState } from 'react';
import client from '../api/client';

const REASONS = [
  { value: 'wrong_package', label: 'Purchased wrong package' },
  { value: 'system_error', label: 'System error — did not receive items' },
  { value: 'device_incompatible', label: 'Game does not run on my device' },
  { value: 'other', label: 'Other reason' },
];

export default function RefundRequestModal({ order, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Please select a reason');
      return;
    }
    if (reason === 'other' && !reasonDetail.trim()) {
      setError('Please describe your reason');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await client.post('/api/refunds', {
        orderId: order.id,
        reason,
        reasonDetail: reason === 'other' ? reasonDetail : null,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Refund request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="refund-title">
        <h2 id="refund-title">Request Refund</h2>
        <p className="hint">
          Order #{order.shortId || order.id.slice(0, 8)} — {order.description || order.product_key}
        </p>
        <p className="refund-notice">
          Your request will be reviewed by an admin. If approved, {order.gold_unspent?.toLocaleString() || 0} Gold
          from this purchase will be deducted and funds return to your payment method in 5–10 business days.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reason">Reason</label>
            <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">Select a reason…</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {reason === 'other' && (
            <div className="form-group">
              <label htmlFor="detail">Details</label>
              <textarea
                id="detail"
                rows={3}
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                required
              />
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Refund Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
