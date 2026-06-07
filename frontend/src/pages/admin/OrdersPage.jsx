import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/api/admin/orders')
      .then((res) => setOrders(res.data.orders))
      .catch((err) => setError(err.response?.data?.error || 'Could not load orders'));
  }, []);

  return (
    <div className="table-wrap">
      {error && <p className="error">{error}</p>}
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
  );
}
