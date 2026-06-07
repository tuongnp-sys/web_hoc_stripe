import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useStripeMode } from '../context/StripeModeContext';
import OrderSummary from '../components/OrderSummary';

export default function Deposit() {
  const { user, refreshUser } = useAuth();
  const { mode: stripeMode, config: stripeConfig } = useStripeMode();
  const [products, setProducts] = useState([]);
  const [goldBalance, setGoldBalance] = useState(0);
  const [premium, setPremium] = useState(false);
  const [selected, setSelected] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshUser?.().catch(() => {});
    Promise.all([
      client.get('/api/products'),
      client.get('/api/wallet'),
      client.get('/api/entitlements'),
    ])
      .then(([prodRes, walletRes, entRes]) => {
        const goldPacks = prodRes.data.products.filter((p) => p.mode === 'payment');
        setProducts(goldPacks);
        setGoldBalance(walletRes.data.goldBalance);
        setPremium(entRes.data.premium);
        if (goldPacks.length) setSelected(goldPacks[0]);
      })
      .catch(() => setError('Could not load store'))
      .finally(() => setLoading(false));
  }, [refreshUser]);

  const handleBuy = async (product) => {
    if (!product?.key) return;

    setBuying(product.key);
    setError('');
    try {
      const res = await client.post('/api/checkout/deposit', { productKey: product.key });
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      setError('Could not start checkout');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email before purchasing.');
      } else if (code === 'LIVE_MODE_NOT_READY') {
        const blockers = err.response?.data?.blockers || [];
        setError(`Live mode not ready: ${blockers.join(', ')}`);
      } else {
        setError(err.response?.data?.error || 'Payment error');
      }
    } finally {
      setBuying(null);
    }
  };

  const handleSubscribe = async () => {
    setBuying('premium');
    setError('');
    try {
      const res = await client.post('/api/checkout/subscription');
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      setError('Could not start subscription checkout');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email before purchasing.');
      } else if (code === 'LIVE_MODE_NOT_READY') {
        const blockers = err.response?.data?.blockers || [];
        setError(`Live mode not ready: ${blockers.join(', ')}`);
      } else {
        setError(err.response?.data?.error || 'Subscription error');
      }
    } finally {
      setBuying(null);
    }
  };

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container container-wide">
      <h1>Add Funds</h1>

      {stripeMode === 'test' && (
        <div className="banner" style={{ background: '#dbeafe', color: '#1e40af' }}>
          Test mode — use card <code>{stripeConfig?.testCardHint || '4242 4242 4242 4242'}</code>
        </div>
      )}
      {stripeMode === 'live' && (
        <div className="banner" style={{ background: '#fee2e2', color: '#991b1b' }}>
          Live mode — real charges will be made.
        </div>
      )}

      {!user?.emailVerified && (
        <div className="banner">
          Verify your email to make purchases.{' '}
          <Link to="/verify-email/pending">Resend verification</Link>
        </div>
      )}

      <div className="balance-header card">
        <div>
          <p className="balance-label">Current Balance</p>
          <p className="balance-value">{goldBalance.toLocaleString()} Gold</p>
        </div>
        <p className="hint">Account: {user?.email}</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="deposit-layout">
        <div className="deposit-main">
          <h2>Gold Packs</h2>
          <p className="hint">
            Gold is virtual currency for in-game use only. No real-money gambling.
          </p>
          <div className="tier-grid">
            {products.map((p) => (
              <div
                key={p.key}
                role="button"
                tabIndex={0}
                className={`tier-card card ${selected?.key === p.key ? 'tier-selected' : ''}`}
                onClick={() => setSelected(p)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(p)}
              >
                {p.badge && <span className="tier-badge">{p.badge}</span>}
                <h3>{p.name}</h3>
                <p className="tier-gold">+{p.gold.toLocaleString()} Gold</p>
                <p className="tier-price">{p.displayPrice}</p>
                {p.savings && <p className="tier-savings">{p.savings}</p>}
                <button
                  type="button"
                  className="btn tier-btn"
                  disabled={buying === p.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuy(p);
                  }}
                >
                  {buying === p.key ? 'Redirecting…' : 'Buy Now'}
                </button>
              </div>
            ))}
          </div>

          <div className="form-group promo-group">
            <label htmlFor="promo">Promo Code</label>
            <input
              id="promo"
              type="text"
              placeholder="Enter code at Stripe Checkout"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />
            <p className="hint">Promo codes are applied on the Stripe payment page.</p>
          </div>

          <div className="card premium-card">
            <h3>Premium Monthly</h3>
            <p className="hint">Exclusive perks — $9.99/month</p>
            <button
              type="button"
              className="btn"
              disabled={premium || buying === 'premium'}
              onClick={handleSubscribe}
            >
              {premium ? 'Active' : buying === 'premium' ? 'Redirecting…' : 'Subscribe'}
            </button>
          </div>
        </div>

        <aside className="deposit-sidebar">
          <OrderSummary
            product={selected}
            promoNote={promoCode ? `Code "${promoCode}" at checkout` : null}
          />
          {selected && (
            <button
              type="button"
              className="btn"
              disabled={buying === selected.key}
              onClick={() => handleBuy(selected)}
            >
              {buying === selected.key ? 'Redirecting to Stripe…' : 'Proceed to Payment'}
            </button>
          )}
        </aside>
      </div>

      <p className="hint">
        {import.meta.env.DEV && (
          <>
            Test card: <code>4242 4242 4242 4242</code> ·{' '}
          </>
        )}
        <Link to="/billing">Billing History</Link> · <Link to="/">Back to Game</Link>
      </p>
    </div>
  );
}
