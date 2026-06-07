import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function WebhooksPage() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/api/admin/webhook-events')
      .then((res) => setEvents(res.data.events))
      .catch((err) => setError(err.response?.data?.error || 'Could not load webhooks'));
  }, []);

  return (
    <div className="table-wrap">
      {error && <p className="error">{error}</p>}
      <table className="billing-table admin-table">
        <thead>
          <tr>
            <th>Event ID</th>
            <th>Type</th>
            <th>Processed at</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.stripe_event_id}>
              <td><code>{ev.stripe_event_id}</code></td>
              <td>{ev.type}</td>
              <td>{new Date(ev.processed_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
