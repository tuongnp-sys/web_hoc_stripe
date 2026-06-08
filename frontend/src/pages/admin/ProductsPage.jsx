import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useAdminSession } from '../../context/AdminSessionContext';

const CATEGORY_ORDER = ['energy', 'gold', 'vip'];
const CATEGORY_LABELS = {
  energy: 'Energy Packs',
  gold: 'Gold Packs',
  vip: 'VIP',
};

function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value) {
  const n = Math.round(parseFloat(value) * 100);
  return Number.isFinite(n) ? n : null;
}

function ProductRow({ product, canEdit, onSaved, onError }) {
  const [draft, setDraft] = useState({
    name: product.name,
    description: product.description || '',
    price: centsToDollars(product.amount_cents),
    badge: product.badge || '',
    savings: product.savings || '',
    sortOrder: String(product.sort_order ?? 0),
    enabled: product.enabled,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      name: product.name,
      description: product.description || '',
      price: centsToDollars(product.amount_cents),
      badge: product.badge || '',
      savings: product.savings || '',
      sortOrder: String(product.sort_order ?? 0),
      enabled: product.enabled,
    });
  }, [product]);

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const amountCents =
        extra.resetPrice === true ? null : dollarsToCents(draft.price);
      if (extra.resetPrice !== true && amountCents == null) {
        onError('Enter a valid price');
        return;
      }

      const res = await client.patch(`/api/admin/products/${product.product_key}`, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        amountCents,
        badge: draft.badge.trim() || null,
        savings: draft.savings.trim() || null,
        sortOrder: Number(draft.sortOrder) || 0,
        enabled: draft.enabled,
        ...extra.body,
      });
      onSaved(res.data.product);
    } catch (err) {
      onError(err.response?.data?.error || 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td><code>{product.product_key}</code></td>
      <td>
        {canEdit ? (
          <input
            type="text"
            className="admin-input-inline"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        ) : (
          product.name
        )}
      </td>
      <td>
        {canEdit ? (
          <input
            type="number"
            step="0.01"
            min="0.5"
            className="admin-input-inline admin-input-price"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
          />
        ) : (
          `$${centsToDollars(product.amount_cents)}`
        )}
        <div className="hint admin-price-meta">
          Store: {product.display_price}
          {product.price_overridden && (
            <span className="admin-badge admin-badge-custom">Custom price</span>
          )}
          {product.default_amount_cents !== product.amount_cents && (
            <span> · Default ${centsToDollars(product.default_amount_cents)}</span>
          )}
        </div>
      </td>
      <td>
        {canEdit ? (
          <input
            type="text"
            className="admin-input-inline"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        ) : (
          product.description || '—'
        )}
      </td>
      <td>
        {canEdit ? (
          <input
            type="text"
            className="admin-input-inline admin-input-short"
            value={draft.badge}
            onChange={(e) => setDraft((d) => ({ ...d, badge: e.target.value }))}
            placeholder="Badge"
          />
        ) : (
          product.badge || '—'
        )}
      </td>
      <td>
        {canEdit ? (
          <input
            type="text"
            className="admin-input-inline admin-input-short"
            value={draft.savings}
            onChange={(e) => setDraft((d) => ({ ...d, savings: e.target.value }))}
            placeholder="Savings"
          />
        ) : (
          product.savings || '—'
        )}
      </td>
      <td>
        {canEdit ? (
          <input
            type="number"
            className="admin-input-inline admin-input-short"
            value={draft.sortOrder}
            onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
          />
        ) : (
          product.sort_order
        )}
      </td>
      <td>
        {canEdit ? (
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span>{draft.enabled ? 'Open' : 'Closed'}</span>
          </label>
        ) : (
          <span className={`admin-badge ${product.enabled ? 'admin-badge-active' : 'admin-badge-suspended'}`}>
            {product.enabled ? 'Open' : 'Closed'}
          </span>
        )}
      </td>
      {canEdit && (
        <td className="admin-product-actions">
          <button type="button" className="link-btn" disabled={saving} onClick={() => save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {product.price_overridden && (
            <button
              type="button"
              className="link-btn"
              disabled={saving}
              onClick={() => save({ resetPrice: true })}
            >
              Reset price
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

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

  const grouped = useMemo(() => {
    const map = new Map(CATEGORY_ORDER.map((c) => [c, []]));
    for (const p of products) {
      const cat = p.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(p);
    }
    return CATEGORY_ORDER.map((cat) => ({ category: cat, items: map.get(cat) || [] }));
  }, [products]);

  const handleSaved = (updated) => {
    setFlash(`Saved ${updated.name}`);
    setError('');
    setProducts((prev) =>
      prev.map((p) => (p.product_key === updated.product_key ? { ...p, ...updated } : p))
    );
  };

  return (
    <div>
      <p className="hint admin-products-note">
        New prices apply to future checkouts only. Custom prices use dynamic Stripe checkout amounts.
      </p>
      {flash && <p className="admin-flash admin-flash-success">{flash}</p>}
      {error && <p className="error">{error}</p>}

      {grouped.map(({ category, items }) => (
        <section key={category} className="admin-product-section">
          <h2 className="admin-section-title">{CATEGORY_LABELS[category] || category}</h2>
          <div className="table-wrap">
            <table className="billing-table admin-table admin-products-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Name</th>
                  <th>Price ($)</th>
                  <th>Description</th>
                  <th>Badge</th>
                  <th>Savings</th>
                  <th>Order</th>
                  <th>Store</th>
                  {capabilities?.canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <ProductRow
                    key={p.product_key}
                    product={p}
                    canEdit={capabilities?.canEdit}
                    onSaved={handleSaved}
                    onError={setError}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
