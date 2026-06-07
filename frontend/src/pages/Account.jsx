import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

export default function Account() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/api/account')
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load account'))
      .finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const res = await client.post('/api/portal');
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open Customer Portal.');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <h1>Account</h1>
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Wallet</h2>
        <p className="balance-value">{(data?.goldBalance ?? 0).toLocaleString()} Gold</p>
        <p className={data?.premium ? 'success-text' : 'warn-text'}>
          Premium: {data?.premium ? 'Active' : 'Not subscribed'}
        </p>
        {data?.subscriptions?.length > 0 && (
          <button type="button" className="btn btn-secondary" onClick={openPortal} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : 'Manage Subscription (Stripe Portal)'}
          </button>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Quick Links</h2>
        <p>
          <Link to="/deposit">Add Funds</Link> · <Link to="/billing">Billing History</Link> ·{' '}
          <Link to="/verify-email/pending">Email Verification</Link>
        </p>
      </div>

      <p className="hint" style={{ marginTop: '1rem' }}>
        <Link to="/">Back to Game</Link>
      </p>
    </div>
  );
}
