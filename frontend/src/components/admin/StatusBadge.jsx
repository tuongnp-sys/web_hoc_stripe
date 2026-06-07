export default function StatusBadge({ status, isRoot }) {
  if (isRoot) {
    return <span className="admin-badge admin-badge-root">Root</span>;
  }
  if (status === 'suspended') {
    return <span className="admin-badge admin-badge-suspended">Suspended</span>;
  }
  return <span className="admin-badge admin-badge-active">Active</span>;
}
