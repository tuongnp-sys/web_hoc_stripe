import ScopeBadge from './ScopeBadge';
import StatusBadge from './StatusBadge';

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`admin-toggle${disabled ? ' admin-toggle-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function UserDetailDrawer({ detail, capabilities, onClose, onEdit, onToggleEntitlement, onToggleOrderAccess, onAdjustGold }) {
  const u = detail.user;
  const canEdit = capabilities?.canEdit;

  return (
    <div className="admin-drawer-overlay" onClick={onClose} role="presentation">
      <aside className="admin-drawer card" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="admin-drawer-head">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{u.email}</h2>
          <button type="button" className="admin-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="hint">
          <ScopeBadge scope={u.admin_scope} role={u.role} /> ·{' '}
          <StatusBadge status={u.account_status} isRoot={u.is_root} />
        </p>

        <dl className="admin-dl">
          <dt>Gold</dt>
          <dd>{detail.goldBalance}</dd>
          <dt>Verified</dt>
          <dd>{u.email_verified ? 'Yes' : 'No'}</dd>
          <dt>Note</dt>
          <dd>{u.internal_note || '—'}</dd>
          <dt>ID</dt>
          <dd><code>{u.id}</code></dd>
        </dl>

        {canEdit && (
          <div className="admin-drawer-actions">
            <button type="button" className="btn btn-secondary admin-btn-inline" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="btn btn-secondary admin-btn-inline" onClick={() => onAdjustGold(u.id)}>
              Adjust Gold
            </button>
          </div>
        )}

        <h3 className="admin-section-title">Entitlements</h3>
        <div className="admin-chip-row">
          {['premium', 'game_unlock'].map((key) => {
            const ent = detail.entitlements.find((e) => e.feature_key === key);
            const active = ent?.active ?? false;
            return (
              <div key={key} className="admin-chip card">
                <strong>{key}</strong>
                <Toggle
                  label={active ? 'On' : 'Off'}
                  checked={active}
                  disabled={!canEdit}
                  onChange={(v) => onToggleEntitlement(u.id, key, v)}
                />
              </div>
            );
          })}
        </div>

        <h3 className="admin-section-title">Orders</h3>
        <div className="table-wrap">
          <table className="billing-table admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {detail.orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.description || o.product_key}</td>
                  <td>{o.status}</td>
                  <td>
                    {o.status === 'paid' ? (
                      <Toggle
                        label={o.access_enabled ? 'On' : 'Off'}
                        checked={o.access_enabled}
                        disabled={!canEdit}
                        onChange={(v) => onToggleOrderAccess(o.id, v)}
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
      </aside>
    </div>
  );
}
