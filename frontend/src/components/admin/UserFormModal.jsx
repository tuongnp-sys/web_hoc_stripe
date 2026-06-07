import { useState } from 'react';
import client from '../../api/client';
import { SCOPE_OPTIONS } from '../../constants/adminCopy';
import PasswordStrengthMeter, { passwordStrength } from '../PasswordStrengthMeter';

export default function UserFormModal({ mode, detail, capabilities, onClose, onSaved }) {
  const isCreate = mode === 'create';
  const u = detail?.user;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailVerified, setEmailVerified] = useState(Boolean(u?.email_verified));
  const [role, setRole] = useState(u?.role || 'user');
  const [adminScope, setAdminScope] = useState(u?.admin_scope || 'view');
  const [internalNote, setInternalNote] = useState(u?.internal_note || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canFull = capabilities?.canFull;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isCreate) {
      if (passwordStrength(password).passed < 5) {
        setError('Password does not meet requirements');
        return;
      }
    }

    setLoading(true);
    try {
      if (isCreate) {
        const res = await client.post('/api/admin/users', {
          email,
          password,
          role,
          emailVerified,
          adminScope: role === 'admin' ? adminScope : 'none',
        });
        onSaved(res.data.user);
      } else {
        const body = { emailVerified, internalNote };
        if (canFull && !u.is_root) {
          body.role = role;
          if (role === 'admin') body.adminScope = adminScope;
        }
        const res = await client.patch(`/api/admin/users/${u.id}`, body);
        onSaved(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal card admin-user-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2 style={{ marginTop: 0 }}>{isCreate ? 'Add user' : 'Edit user'}</h2>
        {!isCreate && <p className="hint" style={{ marginTop: 0 }}>{u.email}</p>}

        <form onSubmit={handleSubmit}>
          {isCreate && (
            <>
              <div className="form-group">
                <label htmlFor="uf-email">Email</label>
                <input id="uf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="uf-pass">Password</label>
                <input id="uf-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <PasswordStrengthMeter password={password} />
              </div>
            </>
          )}

          <label className="admin-toggle">
            <input type="checkbox" checked={emailVerified} onChange={(e) => setEmailVerified(e.target.checked)} />
            <span>Email verified</span>
          </label>

          {(isCreate || (canFull && !u?.is_root)) && (
            <div className="form-group">
              <label htmlFor="uf-role">Role</label>
              <select id="uf-role" className="admin-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          {(isCreate || canFull) && role === 'admin' && (!u || !u.is_root) && (
            <fieldset className="admin-perm-fieldset">
              <legend>Admin scope</legend>
              {SCOPE_OPTIONS.map((opt) => (
                <label key={opt.value} className="admin-perm-option">
                  <input
                    type="radio"
                    name="adminScope"
                    value={opt.value}
                    checked={adminScope === opt.value}
                    onChange={() => setAdminScope(opt.value)}
                  />
                  <span>
                    <strong>{opt.label}</strong>
                    <small>{opt.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <div className="form-group">
            <label htmlFor="uf-note">Internal note</label>
            <textarea
              id="uf-note"
              className="admin-textarea"
              rows={3}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Saving…' : isCreate ? 'Create user' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
