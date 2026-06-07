import { SCOPE_LABELS } from '../../constants/adminCopy';

const CLASSES = {
  view: 'admin-badge-scope-view',
  edit: 'admin-badge-scope-edit',
  full: 'admin-badge-scope-full',
};

export default function ScopeBadge({ scope, role }) {
  if (role !== 'admin' || !scope || scope === 'none') {
    return <span className="admin-badge admin-badge-user">—</span>;
  }
  return (
    <span className={`admin-badge ${CLASSES[scope] || ''}`}>{SCOPE_LABELS[scope] || scope}</span>
  );
}
