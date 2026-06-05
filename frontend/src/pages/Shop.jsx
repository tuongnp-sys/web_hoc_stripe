import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Shop() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [entitlements, setEntitlements] = useState({ gameUnlock: false, premium: false });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([client.get('/api/products'), client.get('/api/entitlements')])
      .then(([prodRes, entRes]) => {
        setProducts(prodRes.data.products);
        setEntitlements(entRes.data);
      })
      .catch(() => setError('Không tải được cửa hàng'))
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (product) => {
    setBuying(product.key);
    setError('');
    try {
      const path =
        product.mode === 'subscription' ? '/api/checkout/subscription' : '/api/checkout/one-time';
      const res = await client.post(path);
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      setError('Không nhận được link thanh toán');
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi thanh toán');
    } finally {
      setBuying(null);
    }
  };

  const owned = (key) => {
    if (key === 'game_unlock') return entitlements.gameUnlock;
    if (key === 'premium_monthly') return entitlements.premium;
    return false;
  };

  if (loading) return <div className="container">Đang tải…</div>;

  return (
    <div className="container">
      <h1>Cửa hàng</h1>
      <p className="hint">Tài khoản: {user?.email}</p>
      {error && <p className="error">{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {products.map((p) => (
          <div key={p.key} className="card">
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{p.name}</h2>
            <p style={{ margin: '0 0 0.75rem', color: '#64748b' }}>{p.description}</p>
            <p style={{ margin: '0 0 0.75rem', fontWeight: 700 }}>{p.displayPrice}</p>
            <button
              type="button"
              className="btn"
              disabled={owned(p.key) || buying === p.key}
              onClick={() => handleBuy(p)}
            >
              {owned(p.key)
                ? 'Đã sở hữu'
                : buying === p.key
                  ? 'Đang chuyển tới Stripe…'
                  : p.mode === 'subscription'
                    ? 'Đăng ký'
                    : 'Mua ngay'}
            </button>
          </div>
        ))}
      </div>
      <p className="hint">
        Thẻ test: <code>4242 4242 4242 4242</code> — <Link to="/">← Về game</Link>
      </p>
    </div>
  );
}
