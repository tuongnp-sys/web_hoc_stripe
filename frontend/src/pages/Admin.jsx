import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const TABS = ['users', 'products', 'orders', 'audit', 'webhooks'];

function Toggle({ checked, onChange, label }) {
  return (
    <label className="admin-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [audit, setAudit] = useState([]);
  const [webhooks, setWebhooks] = useState([]);

  const loadUsers = useCallback(async (q = search) => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/api/admin/users', { params: { search: q, limit: 50 } });
      setUsers(res.data.users);
      setUserTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Cannot load users — sign in as admin');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadUserDetail = async (id) => {
    setLoading(true);
    try {
      const res = await client.get(`/api/admin/users/${id}`);
      setSelectedUser(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Cannot load user');
    } finally {
      setLoading(false);
    }
  };

  const loadTab = useCallback(async () => {
    setError('');
    try {
      if (tab === 'users') await loadUsers();
      if (tab === 'products') {
        const res = await client.get('/api/admin/products');
        setProducts(res.data.products);
      }
      if (tab === 'orders') {
        const res = await client.get('/api/admin/orders');
        setOrders(res.data.orders);
      }
      if (tab === 'audit') {
        const res = await client.get('/api/admin/audit-log');
        setAudit(res.data.events);
      }
      if (tab === 'webhooks') {
        const res = await client.get('/api/admin/webhook-events');
        setWebhooks(res.data.events);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Admin API error');
    }
  }, [tab, loadUsers]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container">
        <p className="error">Admin access required. Sign in with an admin account.</p>
        <p className="hint">
          Dev: <code>admin@localhost</code> / <code>admin123456</code>
        </p>
      </div>
    );
  }

  const updateUser = async (id, body) => {
    await client.patch(`/api/admin/users/${id}`, body);
    await loadUserDetail(id);
    await loadUsers();
  };

  const deleteUser = async (id, email) => {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return;
    await client.delete(`/api/admin/users/${id}`);
    setSelectedUser(null);
    await loadUsers();
  };

  const toggleEntitlement = async (userId, featureKey, active) => {
    await client.patch(`/api/admin/users/${userId}/entitlements/${featureKey}`, { active });
    await loadUserDetail(userId);
  };

  const toggleOrderAccess = async (orderId, accessEnabled) => {
    const userId = selectedUser?.user?.id;
    await client.patch(`/api/admin/orders/${orderId}/access`, { accessEnabled });
    if (userId) await loadUserDetail(userId);
  };

  const adjustGold = async (userId) => {
    const raw = window.prompt('Gold adjustment (+/- integer):', '100');
    if (raw == null) return;
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount === 0) return;
    await client.patch(`/api/admin/users/${userId}/wallet`, { amount, note: 'Admin adjustment' });
    await loadUserDetail(userId);
    await loadUsers();
  };

  const toggleProduct = async (key, enabled) => {
    await client.patch(`/api/admin/products/${key}`, { enabled });
    const res = await client.get('/api/admin/products');
    setProducts(res.data.products);
  };

  return (
    <div className="container container-wide">
      <h1>Admin Dashboard</h1>
      <p className="hint">Signed in as {user.email}</p>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="hint">Loading…</p>}

      {tab === 'users' && (
        <div className="admin-layout">
          <div className="card">
            <form
              className="admin-search"
              onSubmit={(e) => {
                e.preventDefault();
                loadUsers(search);
              }}
            >
              <input
                type="search"
                placeholder="Search email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" style={{ width: 'auto', margin: 0 }}>
                Search
              </button>
            </form>
            <p className="hint">{userTotal} users</p>
            <div className="table-wrap">
              <table className="billing-table admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Verified</th>
                    <th>Gold</th>
                    <th>Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={selectedUser?.user?.id === u.id ? 'row-selected' : ''}>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.email_verified ? 'Yes' : 'No'}</td>
                      <td>{u.gold_balance}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <button type="button" className="link-btn" onClick={() => loadUserDetail(u.id)}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedUser && (
            <div className="card admin-detail">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>{selectedUser.user.email}</h2>
              <p className="hint">
                ID: <code>{selectedUser.user.id}</code> · Gold: {selectedUser.goldBalance}
              </p>

              <div className="admin-actions">
                <Toggle
                  label="Email verified"
                  checked={selectedUser.user.email_verified}
                  onChange={(v) => updateUser(selectedUser.user.id, { emailVerified: v })}
                />
                <Toggle
                  label="Admin role"
                  checked={selectedUser.user.role === 'admin'}
                  onChange={(v) => updateUser(selectedUser.user.id, { role: v ? 'admin' : 'user' })}
                />
                <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => adjustGold(selectedUser.user.id)}>
                  Adjust gold
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', color: '#b91c1c' }}
                  onClick={() => deleteUser(selectedUser.user.id, selectedUser.user.email)}
                >
                  Delete user
                </button>
              </div>

              <h3 className="admin-section-title">Entitlements (subscriptions / unlocks)</h3>
              <div className="admin-chip-row">
                {['premium', 'game_unlock'].map((key) => {
                  const ent = selectedUser.entitlements.find((e) => e.feature_key === key);
                  const active = ent?.active ?? false;
                  return (
                    <div key={key} className="admin-chip card">
                      <strong>{key}</strong>
                      <Toggle
                        label={active ? 'Enabled' : 'Disabled'}
                        checked={active}
                        onChange={(v) => toggleEntitlement(selectedUser.user.id, key, v)}
                      />
                    </div>
                  );
                })}
              </div>

              <h3 className="admin-section-title">Purchased packages (orders)</h3>
              <div className="table-wrap">
                <table className="billing-table admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Gold</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.description || o.product_key}</td>
                        <td>{o.status}</td>
                        <td>{o.gold_amount > 0 ? `${o.gold_unspent}/${o.gold_amount}` : '—'}</td>
                        <td>
                          {o.status === 'paid' ? (
                            <Toggle
                              label={o.access_enabled ? 'On' : 'Off'}
                              checked={o.access_enabled}
                              onChange={(v) => toggleOrderAccess(o.id, v)}
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Store packages (global on/off)</h2>
          <div className="table-wrap">
            <table className="billing-table admin-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Name</th>
                  <th>Mode</th>
                  <th>Storefront</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_key}>
                    <td><code>{p.product_key}</code></td>
                    <td>{p.name}</td>
                    <td>{p.mode}</td>
                    <td>
                      <Toggle
                        label={p.enabled ? 'Open' : 'Closed'}
                        checked={p.enabled}
                        onChange={(v) => toggleProduct(p.product_key, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="card table-wrap">
          <table className="billing-table admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.email}</td>
                  <td>{o.product_key}</td>
                  <td>{(o.amount / 100).toFixed(2)} {o.currency}</td>
                  <td>{o.status}</td>
                  <td>{new Date(o.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <pre className="admin-pre">{JSON.stringify(audit, null, 2)}</pre>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="card">
          <pre className="admin-pre">{JSON.stringify(webhooks, null, 2)}</pre>
        </div>
      )}

      <p className="hint">
        <Link to="/">Back to Game</Link>
      </p>
    </div>
  );
}
