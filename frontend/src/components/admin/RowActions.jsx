import { useEffect, useRef, useState } from 'react';

export default function RowActions({
  capabilities,
  user,
  actions,
  onView,
  onEdit,
  onToggleSuspend,
  onDeletePermanent,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const suspended = user.account_status === 'suspended';
  const canEdit = capabilities?.canEdit;
  const canDelete = capabilities?.canDeletePermanent && actions?.canDeletePermanent;

  return (
    <div className="admin-row-actions-wrap">
      <button type="button" className="admin-icon-btn" title="View" onClick={onView}>
        👁
      </button>
      <button
        type="button"
        className="admin-icon-btn"
        title={canEdit ? 'Edit' : 'Requires View + Edit scope'}
        disabled={!canEdit}
        onClick={onEdit}
      >
        ✏️
      </button>
      <button
        type="button"
        className="admin-icon-btn admin-icon-btn-lock"
        title={
          suspended
            ? 'Unlock / restore'
            : 'Suspend temporarily (reversible)'
        }
        disabled={!canEdit || (suspended ? !actions?.canRestore : !actions?.canSuspend)}
        onClick={onToggleSuspend}
      >
        {suspended ? '🔓' : '🔒'}
      </button>
      <div className="admin-row-menu" ref={ref}>
        <button
          type="button"
          className="admin-icon-btn"
          title="More actions"
          onClick={() => setMenuOpen((v) => !v)}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="admin-row-menu-panel card">
            <button
              type="button"
              className="admin-menu-danger"
              disabled={!canDelete}
              title={actions?.deleteBlockedReason || ''}
              onClick={() => {
                setMenuOpen(false);
                onDeletePermanent();
              }}
            >
              Delete permanently
              <small>cannot be restored</small>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
