export default function StoreProductGrid({
  products,
  selectedKey,
  buying,
  onSelect,
  onBuy,
  variant = 'energy',
}) {
  if (!products.length) {
    return (
      <div className="card store-empty-state">
        <p className="hint">No packages available in this category right now.</p>
      </div>
    );
  }

  return (
    <div className="tier-grid">
      {products.map((p) => (
        <div
          key={p.key}
          role="button"
          tabIndex={0}
          className={`tier-card card ${selectedKey === p.key ? 'tier-selected' : ''}`}
          onClick={() => onSelect(p)}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(p)}
        >
          {p.badge && <span className="tier-badge">{p.badge}</span>}
          <h3>{p.name}</h3>
          {variant === 'gold' ? (
            <p className="tier-gold">+{p.gold.toLocaleString()} Gold</p>
          ) : (
            <p className="tier-gold">{p.description}</p>
          )}
          <p className="tier-price">{p.displayPrice}</p>
          {p.savings && <p className="tier-savings">{p.savings}</p>}
          <button
            type="button"
            className="btn tier-btn"
            disabled={buying === p.key}
            onClick={(e) => {
              e.stopPropagation();
              onBuy(p);
            }}
          >
            {buying === p.key ? 'Redirecting…' : 'Buy Now'}
          </button>
        </div>
      ))}
    </div>
  );
}
