import { Link } from 'react-router-dom';

export default function Cancel() {
  return (
    <div className="container">
      <div className="banner">Payment was cancelled. You can try again anytime.</div>
      <div className="card">
        <h1>Payment Cancelled</h1>
        <Link to="/deposit">← Back to Add Funds</Link>
      </div>
    </div>
  );
}
