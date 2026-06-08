import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useStripeMode } from '../context/StripeModeContext';
import OrderSummary from '../components/OrderSummary';
import StoreProductGrid from '../components/StoreProductGrid';

const TABS = [
  { id: 'energy', label: 'Energy' },
  { id: 'vip', label: 'VIP' },
  { id: 'gold', label: 'Gold' },
];

const TAB_CONTENT = {
  energy: {
    title: 'Energy Packs',
    hint: 'Each meditation run from Layer 1 costs 1 energy (VIP plays freely).',
    variant: 'energy',
  },
  gold: {
    title: 'Gold Packs',
    hint: 'Gold is virtual currency. Spend 100 Gold in-game to refill energy, or play Gold Rush at /bonus.',
    variant: 'gold',
  },
};

function tabFromProduct(product) {
  if (!product) return null;
  if (product.category === 'energy') return 'energy';
  if (product.category === 'gold') return 'gold';
  if (product.key === 'premium_monthly') return 'vip';
  return null;
}

export default function Deposit() {
  const { user, refreshUser } = useAuth();
  const { mode: stripeMode, config: stripeConfig } = useStripeMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState([]);
  const [goldBalance, setGoldBalance] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [premium, setPremium] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return TABS.some((t) => t.id === tab) ? tab : 'energy';
  });
  const [selected, setSelected] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState('');

  const productsByTab = useMemo(() => {
    const energy = allProducts.filter((p) => p.category === 'energy');
    const gold = allProducts.filter((p) => p.category === 'gold');
    const vip = allProducts.filter((p) => p.key === 'premium_monthly');
    return { energy, gold, vip };
  }, [allProducts]);

  const tabProducts = productsByTab[activeTab] || [];
  const vipProduct = productsByTab.vip[0] || null;

  const loadStoreData = useCallback(async () => {
    const [prodRes, walletRes, entRes, gameRes] = await Promise.all([
      client.get('/api/products'),
      client.get('/api/wallet'),
      client.get('/api/entitlements'),
      client.get('/api/game/profile').catch(() => ({ data: { energy: 0 } })),
    ]);
    setAllProducts(prodRes.data.products);
    setGoldBalance(walletRes.data.goldBalance);
    setEnergy(gameRes.data.energy ?? 0);
    setPremium(entRes.data.premium);
    return prodRes.data.products;
  }, []);

  useEffect(() => {
    refreshUser?.().catch(() => {});
    loadStoreData()
      .catch(() => setError('Could not load store'))
      .finally(() => setInitialLoading(false));
  }, [refreshUser, loadStoreData]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }

    const productKey = searchParams.get('product');
    if (!productKey || !allProducts.length) return;

    const match = allProducts.find((p) => p.key === productKey);
    if (!match) return;

    const productTab = tabFromProduct(match);
    if (productTab) setActiveTab(productTab);
    setSelected(match);
  }, [searchParams, allProducts]);

  useEffect(() => {
    setSelected((prev) => {
      if (activeTab === 'vip') return null;
      if (prev && tabProducts.some((p) => p.key === prev.key)) return prev;
      return tabProducts[0] ?? null;
    });
  }, [activeTab, tabProducts]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', id);
        next.delete('product');
        return next;
      },
      { replace: true }
    );
  };

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
    setBuying('premium_monthly');
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

  const tabMeta = TAB_CONTENT[activeTab];

  return (
    <div className="container container-wide">
      <h1>Joymed Store</h1>

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

      <div className="balance-header card store-balance-header">
        <div>
          <p className="balance-label">Energy</p>
          <p className="balance-value">{premium ? '∞ VIP' : `${energy} / 5`}</p>
        </div>
        <div>
          <p className="balance-label">Gold</p>
          <p className="balance-value">{goldBalance.toLocaleString()}</p>
        </div>
        <p className="hint">Account: {user?.email}</p>
      </div>

      <div className="store-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`store-tab ${activeTab === tab.id ? 'store-tab-active' : ''}`}
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="deposit-layout">
        <div className="deposit-main">
          {initialLoading ? (
            <div className="store-skeleton card" aria-busy="true">
              <p className="hint">Loading packages…</p>
            </div>
          ) : activeTab === 'vip' ? (
            vipProduct ? (
              <div className="card premium-card">
                <h3>{vipProduct.name}</h3>
                <p className="hint">{vipProduct.description}</p>
                <p className="tier-price">{vipProduct.displayPrice}</p>
                <button
                  type="button"
                  className="btn"
                  disabled={premium || buying === 'premium_monthly'}
                  onClick={handleSubscribe}
                >
                  {premium ? 'Active' : buying === 'premium_monthly' ? 'Redirecting…' : 'Subscribe'}
                </button>
              </div>
            ) : (
              <div className="card store-empty-state">
                <p className="hint">VIP subscription is not available right now.</p>
              </div>
            )
          ) : (
            <>
              <h2>{tabMeta?.title}</h2>
              <p className="hint">{tabMeta?.hint}</p>
              <StoreProductGrid
                products={tabProducts}
                selectedKey={selected?.key}
                buying={buying}
                variant={tabMeta?.variant}
                onSelect={setSelected}
                onBuy={handleBuy}
              />
              {activeTab === 'gold' && tabProducts.length > 0 && (
                <div className="form-group promo-group">
                  <label htmlFor="promo">Promo Code</label>
                  <input
                    id="promo"
                    type="text"
                    placeholder="Enter code at Stripe Checkout"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <aside className="deposit-sidebar">
          {selected && activeTab !== 'vip' && (
            <>
              <OrderSummary
                product={selected}
                promoNote={promoCode ? `Code "${promoCode}" at checkout` : null}
              />
              <button
                type="button"
                className="btn"
                disabled={buying === selected.key}
                onClick={() => handleBuy(selected)}
              >
                {buying === selected.key ? 'Redirecting to Stripe…' : 'Proceed to Payment'}
              </button>
            </>
          )}
        </aside>
      </div>

      <p className="hint">
        <Link to="/billing">Billing History</Link> · <Link to="/">Back to Game</Link>
      </p>
    </div>
  );
}
