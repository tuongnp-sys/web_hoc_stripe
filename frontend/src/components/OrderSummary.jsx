import PaymentMethodBadges from './PaymentMethodBadges';

function formatMoney(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default function OrderSummary({ product, promoNote }) {
  if (!product) {
    return (
      <div className="order-summary card">
        <h3>Order Summary</h3>
        <p className="hint">Select a pack to see details.</p>
      </div>
    );
  }

  return (
    <div className="order-summary card">
      <h3>Order Summary</h3>
      <dl className="summary-lines">
        <div className="summary-row">
          <dt>{product.name}</dt>
          <dd>{formatMoney(product.amount, product.currency)}</dd>
        </div>
        {product.gold > 0 && (
          <div className="summary-row summary-gold">
            <dt>You receive</dt>
            <dd>+{product.gold.toLocaleString()} Gold</dd>
          </div>
        )}
        <div className="summary-row">
          <dt>Subtotal</dt>
          <dd>{formatMoney(product.amount, product.currency)}</dd>
        </div>
        <div className="summary-row hint-row">
          <dt>Tax (VAT / Sales Tax)</dt>
          <dd>Calculated at checkout</dd>
        </div>
        {promoNote && (
          <div className="summary-row hint-row">
            <dt>Promo code</dt>
            <dd>{promoNote}</dd>
          </div>
        )}
        <div className="summary-row summary-total">
          <dt>Estimated total</dt>
          <dd>{formatMoney(product.amount, product.currency)} + tax</dd>
        </div>
      </dl>
      <p className="hint summary-note">
        Final amount including tax is shown on Stripe Checkout before you pay.
      </p>
      <PaymentMethodBadges />
    </div>
  );
}
