import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAdminSession } from '../context/AdminSessionContext';
import ScopeBadge from '../components/admin/ScopeBadge';

const TABS = [
  { id: 'users', label: 'Users', path: '/admin/users' },
  { id: 'products', label: 'Products', path: '/admin/products' },
  { id: 'settings', label: 'Settings', path: '/admin/settings' },
  { id: 'orders', label: 'Orders', path: '/admin/orders' },
  { id: 'audit', label: 'Audit', path: '/admin/audit' },
  { id: 'webhooks', label: 'Webhooks', path: '/admin/webhooks' },
];

export default function AdminLayout({ activeTab, children }) {
  const { session, loading, error } = useAdminSession();
  const actor = session?.actor;
  const [pendingRefundCount, setPendingRefundCount] = useState(0);

  const loadPendingCount = useCallback(() => {
    client
      .get('/api/admin/refund-requests/count')
      .then((res) => setPendingRefundCount(res.data.count ?? 0))
      .catch(() => setPendingRefundCount(0));
  }, []);

  useEffect(() => {
    loadPendingCount();
    const onUpdate = () => loadPendingCount();
    window.addEventListener('admin-refund-updated', onUpdate);
    return () => window.removeEventListener('admin-refund-updated', onUpdate);
  }, [loadPendingCount]);

  return (
    <div className="container container-wide">
      <div className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          {actor && (
            <p className="hint" style={{ marginTop: '0.25rem' }}>
              {actor.email} · <ScopeBadge scope={actor.scope} role={actor.role} />
              {actor.isRoot && ' · Root admin'}
            </p>
          )}
        </div>
        <Link to="/" className="hint">← Back to app</Link>
      </div>

      <nav className="admin-tabs">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={t.path}
            className={`admin-tab ${activeTab === t.id ? 'active' : ''}`}
          >
            {t.label}
            {t.id === 'users' && pendingRefundCount > 0 && (
              <span className="admin-refund-badge">{pendingRefundCount}</span>
            )}
          </Link>
        ))}
      </nav>

      {loading && <p className="hint">Loading permissions…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && children}
    </div>
  );
}
