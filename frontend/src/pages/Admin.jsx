import { useEffect, useState } from 'react';
import client from '../api/client';

export default function Admin() {
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      client.get('/api/admin/orders'),
      client.get('/api/admin/webhook-events'),
    ])
      .then(([o, e]) => {
        setOrders(o.data.orders);
        setEvents(e.data.events);
      })
      .catch(() => setError('Admin API — chỉ dùng khi NODE_ENV=development hoặc có ADMIN_SECRET'));
  }, []);

  if (error) return <div className="container"><p className="error">{error}</p></div>;

  return (
    <div className="container">
      <h1>Admin (dev)</h1>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem' }}>Đơn hàng gần đây</h2>
        <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>{JSON.stringify(orders, null, 2)}</pre>
      </div>
      <div className="card">
        <h2 style={{ fontSize: '1rem' }}>Webhook events</h2>
        <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>{JSON.stringify(events, null, 2)}</pre>
      </div>
    </div>
  );
}
