import { useCallback, useEffect, useState } from 'react';
import client from '../../api/client';
import { useAdminSession } from '../../context/AdminSessionContext';
import ScopeBadge from '../../components/admin/ScopeBadge';
import StatusBadge from '../../components/admin/StatusBadge';
import RowActions from '../../components/admin/RowActions';
import UserDetailDrawer from '../../components/admin/UserDetailDrawer';
import UserFormModal from '../../components/admin/UserFormModal';
import ConfirmDialog from '../../components/admin/ConfirmDialog';

const PAGE_SIZE = 25;

export default function UsersPage() {
  const { capabilities } = useAdminSession();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState('');

  const [drawer, setDrawer] = useState(null);
  const [formMode, setFormMode] = useState(null);
  const [editDetail, setEditDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [actionCache, setActionCache] = useState({});

  const showMsg = (type, message) => {
    setFlash({ type, message });
    if (type === 'error') setError(message);
    else setError('');
  };

  const loadUsers = useCallback(async (q = search, p = page) => {
    setLoading(true);
    try {
      const res = await client.get('/api/admin/users', {
        params: { search: q, limit: PAGE_SIZE, offset: p * PAGE_SIZE },
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Could not load users');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const fetchDetail = async (id) => {
    const res = await client.get(`/api/admin/users/${id}`);
    setActionCache((prev) => ({ ...prev, [id]: res.data.actions }));
    return res.data;
  };

  const openView = async (id) => {
    try {
      const detail = await fetchDetail(id);
      setDrawer(detail);
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Could not load user');
    }
  };

  const openEdit = async (id) => {
    try {
      const detail = drawer?.user?.id === id ? drawer : await fetchDetail(id);
      setEditDetail(detail);
      setFormMode({ mode: 'edit', id });
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Could not load user');
    }
  };

  const requestSuspend = (user) => {
    const suspended = user.account_status === 'suspended';
    setConfirm({
      title: suspended ? 'Unlock account?' : 'Suspend account temporarily?',
      message: suspended
        ? `${user.email} will be able to sign in again.`
        : `${user.email} cannot sign in until an admin unlocks the account. This is reversible.`,
      confirmLabel: suspended ? 'Unlock' : 'Suspend',
      danger: !suspended,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await client.patch(`/api/admin/users/${user.id}`, {
            accountStatus: suspended ? 'active' : 'suspended',
          });
          showMsg('success', suspended ? 'Account unlocked' : 'Account suspended');
          setConfirm(null);
          await loadUsers();
          if (drawer?.user?.id === user.id) {
            const d = await fetchDetail(user.id);
            setDrawer(d);
          }
        } catch (err) {
          showMsg('error', err.response?.data?.error || 'Action failed');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const notifyRefundQueueChange = () => {
    window.dispatchEvent(new Event('admin-refund-updated'));
  };

  const approveRefund = (orderId) => {
    setConfirm({
      title: 'Approve refund request?',
      message: 'This will issue a Stripe refund and deduct unspent Gold from the user. Cannot be undone.',
      confirmLabel: 'Approve Refund',
      danger: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await client.post(`/api/admin/orders/${orderId}/refund`);
          showMsg('success', 'Refund approved and issued');
          setConfirm(null);
          const d = await fetchDetail(drawer.user.id);
          setDrawer(d);
          await loadUsers();
          notifyRefundQueueChange();
        } catch (err) {
          showMsg('error', err.response?.data?.error || 'Refund failed');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const rejectRefund = (orderId) => {
    setConfirm({
      title: 'Reject refund request?',
      message: 'The user will see this request as rejected. No charge will be refunded.',
      confirmLabel: 'Reject',
      danger: false,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await client.post(`/api/admin/orders/${orderId}/refund/reject`);
          showMsg('success', 'Refund request rejected');
          setConfirm(null);
          const d = await fetchDetail(drawer.user.id);
          setDrawer(d);
          await loadUsers();
          notifyRefundQueueChange();
        } catch (err) {
          showMsg('error', err.response?.data?.error || 'Reject failed');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const requestDelete = (user) => {
    setConfirm({
      title: 'Delete permanently?',
      message: `Permanently delete ${user.email}? This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await client.delete(`/api/admin/users/${user.id}`);
          showMsg('success', 'Permanently deleted');
          setConfirm(null);
          setDrawer(null);
          await loadUsers();
        } catch (err) {
          showMsg('error', err.response?.data?.error || 'Could not delete');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="admin-toolbar">
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            loadUsers(search, 0);
          }}
        >
          <input
            type="search"
            placeholder="Search email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary admin-btn-inline">Search</button>
        </form>
        {capabilities?.canCreateUsers && (
          <button type="button" className="btn admin-btn-inline" onClick={() => setFormMode({ mode: 'create' })}>
            + Add user
          </button>
        )}
      </div>

      <p className="hint">
        {total} users · page {page + 1}/{totalPages} · <strong>Lock</strong> = temporary · <strong>⋯</strong> = permanent delete
      </p>

      {flash?.type === 'success' && <p className="admin-flash admin-flash-success">{flash.message}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <p className="hint">Loading…</p>}

      <div className="table-wrap">
        <table className="billing-table admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Scope</th>
              <th>Status</th>
              <th>Gold</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="hint" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  No users
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className={u.pending_refund_count > 0 ? 'admin-refund-pending-row' : undefined}>
                <td>
                  {u.pending_refund_count > 0 && (
                    <span className="admin-refund-dot" title="Pending refund request" aria-hidden="true" />
                  )}
                  {u.email}
                </td>
                <td>{u.role}</td>
                <td><ScopeBadge scope={u.admin_scope} role={u.role} /></td>
                <td><StatusBadge status={u.account_status} isRoot={u.is_root} /></td>
                <td>{u.gold_balance}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <RowActions
                    capabilities={capabilities}
                    user={u}
                    actions={actionCache[u.id]}
                    onView={() => openView(u.id)}
                    onEdit={() => openEdit(u.id)}
                    onToggleSuspend={async () => {
                      if (!actionCache[u.id]) await fetchDetail(u.id);
                      requestSuspend(u);
                    }}
                    onDeletePermanent={async () => {
                      if (!actionCache[u.id]) await fetchDetail(u.id);
                      requestDelete(u);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination admin-pagination">
          <button type="button" className="btn btn-secondary" disabled={page === 0} onClick={() => { const n = page - 1; setPage(n); loadUsers(search, n); }}>
            Previous
          </button>
          <button type="button" className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => { const n = page + 1; setPage(n); loadUsers(search, n); }}>
            Next
          </button>
        </div>
      )}

      {drawer && (
        <UserDetailDrawer
          detail={drawer}
          capabilities={capabilities}
          onClose={() => setDrawer(null)}
          onEdit={() => {
            setEditDetail(drawer);
            setFormMode({ mode: 'edit', id: drawer.user.id });
          }}
          onToggleEntitlement={async (userId, key, active) => {
            try {
              await client.patch(`/api/admin/users/${userId}/entitlements/${key}`, { active });
              const d = await fetchDetail(userId);
              setDrawer(d);
            } catch (err) {
              showMsg('error', err.response?.data?.error || 'Entitlement update failed');
            }
          }}
          onToggleOrderAccess={async (orderId, accessEnabled) => {
            try {
              await client.patch(`/api/admin/orders/${orderId}/access`, { accessEnabled });
              const d = await fetchDetail(drawer.user.id);
              setDrawer(d);
            } catch (err) {
              showMsg('error', err.response?.data?.error || 'Order access update failed');
            }
          }}
          onApproveRefund={approveRefund}
          onRejectRefund={rejectRefund}
          onAdjustGold={async (userId) => {
            const raw = window.prompt('Gold (+/- integer):', '100');
            if (raw == null) return;
            const amount = Number(raw);
            if (!Number.isInteger(amount) || amount === 0) return;
            try {
              await client.patch(`/api/admin/users/${userId}/wallet`, { amount, note: 'Admin adjustment' });
              showMsg('success', 'Gold updated');
              const d = await fetchDetail(userId);
              setDrawer(d);
              await loadUsers();
            } catch (err) {
              showMsg('error', err.response?.data?.error || 'Gold update failed');
            }
          }}
        />
      )}

      {formMode?.mode === 'create' && (
        <UserFormModal
          mode="create"
          capabilities={capabilities}
          onClose={() => setFormMode(null)}
          onSaved={async () => {
            setFormMode(null);
            showMsg('success', 'User created');
            await loadUsers();
          }}
        />
      )}

      {formMode?.mode === 'edit' && editDetail && (
        <UserFormModal
          mode="edit"
          detail={editDetail}
          capabilities={capabilities}
          onClose={() => { setFormMode(null); setEditDetail(null); }}
          onSaved={async () => {
            setFormMode(null);
            setEditDetail(null);
            showMsg('success', 'User saved');
            await loadUsers();
            if (drawer) {
              const d = await fetchDetail(drawer.user.id);
              setDrawer(d);
            }
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          loading={confirmLoading}
          onConfirm={confirm.onConfirm}
          onClose={() => !confirmLoading && setConfirm(null)}
        />
      )}
    </div>
  );
}
