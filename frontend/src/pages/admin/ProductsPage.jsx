import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useAdminSession } from '../../context/AdminSessionContext';

export default function ProductsPage() {
  const { capabilities } = useAdminSession();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = async () => {
    try {
      const res = await client.get('/api/admin/products');
      setProducts(res.data.products);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load products');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key, enabled) => {
    try {
      await client.patch(`/api/admin/products/${key}`, { enabled });
      setFlash(enabled ? 'Product enabled' : 'Product disabled');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update');
    }
  };

  return (
    <div>
      {flash && <p className="admin-flash admin-flash-success">{flash}</p>}
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="billing-table admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Mode</th>
              <th>Store</th>
              {capabilities?.canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.product_key}>
                <td><code>{p.product_key}</code></td>
                <td>{p.name}</td>
                <td>{p.mode}</td>
                <td>
                  <span className={`admin-badge ${p.enabled ? 'admin-badge-active' : 'admin-badge-suspended'}`}>
                    {p.enabled ? 'Open' : 'Closed'}
                  </span>
                </td>
                {capabilities?.canEdit && (
                  <td>
                    <button type="button" className="link-btn" onClick={() => toggle(p.product_key, !p.enabled)}>
                      {p.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
