import { Link } from 'react-router-dom';
import { useAdminSession } from '../context/AdminSessionContext';
import ScopeBadge from '../components/admin/ScopeBadge';

const TABS = [
  { id: 'users', label: 'Users', path: '/admin/users' },
  { id: 'products', label: 'Products', path: '/admin/products' },
  { id: 'orders', label: 'Orders', path: '/admin/orders' },
  { id: 'audit', label: 'Audit', path: '/admin/audit' },
  { id: 'webhooks', label: 'Webhooks', path: '/admin/webhooks' },
];

export default function AdminLayout({ activeTab, children }) {
  const { session, loading, error } = useAdminSession();
  const actor = session?.actor;

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
          </Link>
        ))}
      </nav>

      {loading && <p className="hint">Loading permissions…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && children}
    </div>
  );
}
