import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function AuditPage() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/api/admin/audit-log')
      .then((res) => setEvents(res.data.events))
      .catch((err) => setError(err.response?.data?.error || 'Could not load audit log'));
  }, []);

  return (
    <div className="table-wrap">
      {error && <p className="error">{error}</p>}
      <table className="billing-table admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Target</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id}>
              <td>{new Date(ev.created_at).toLocaleString()}</td>
              <td>{ev.admin_email || '—'}</td>
              <td><code>{ev.action}</code></td>
              <td>{ev.target_type}{ev.target_id ? ` · ${String(ev.target_id).slice(0, 12)}` : ''}</td>
              <td className="admin-audit-details">{ev.details ? JSON.stringify(ev.details) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
