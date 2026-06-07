import { Link } from 'react-router-dom';

const METHODS = [
  { name: 'Visa', label: 'VISA' },
  { name: 'Mastercard', label: 'MC' },
  { name: 'Amex', label: 'AMEX' },
  { name: 'Apple Pay', label: '' },
  { name: 'PayPal', label: 'PayPal' },
];

export default function PaymentMethodBadges() {
  return (
    <div className="payment-badges" aria-label="Accepted payment methods">
      {METHODS.map((m) => (
        <span key={m.name} className="payment-badge" title={m.name}>
          {m.label || m.name}
        </span>
      ))}
    </div>
  );
}
