import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    amount / 100
  );
}

export default function Account() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/api/account')
      .then((res) => setData(res.data))
      .catch(() => setError('Không tải được tài khoản'))
      .finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const res = await client.post('/api/portal');
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Không mở được Customer Portal. Bật Portal trong Stripe Dashboard.');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) return <div className="container">Đang tải…</div>;

  return (
    <div className="container">
      <h1>Tài khoản</h1>
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Quyền đang có</h2>
        <p className={data?.gameUnlock ? 'success-text' : 'warn-text'}>
          Game unlock: {data?.gameUnlock ? 'Có' : 'Chưa'}
        </p>
        <p className={data?.premium ? 'success-text' : 'warn-text'}>
          Premium: {data?.premium ? 'Có' : 'Chưa'}
        </p>
        {data?.subscriptions?.length > 0 && (
          <button type="button" className="btn btn-secondary" onClick={openPortal} disabled={portalLoading}>
            {portalLoading ? 'Đang mở…' : 'Quản lý subscription (Stripe Portal)'}
          </button>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Lịch sử đơn hàng</h2>
        {data?.orders?.length === 0 ? (
          <p className="hint">Chưa có đơn hàng. <Link to="/shop">Mua gói</Link></p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {data.orders.map((o) => (
              <li key={o.id} style={{ marginBottom: '0.5rem' }}>
                {o.product_key} — {formatMoney(o.amount, o.currency)} —{' '}
                <strong>{o.status}</strong> — {new Date(o.created_at).toLocaleString('vi-VN')}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="hint" style={{ marginTop: '1rem' }}>
        <Link to="/shop">Cửa hàng</Link> · <Link to="/">Game</Link>
      </p>
    </div>
  );
}
