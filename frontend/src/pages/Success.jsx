import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [message, setMessage] = useState('Verifying payment with Stripe…');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setMessage('Missing session ID. Return to Add Funds and try again.');
      return;
    }

    let attempts = 0;
    const maxAttempts = 5;

    const verify = () => {
      client
        .get(`/api/checkout/verify-session/${sessionId}`)
        .then(async (res) => {
          if (res.data.paid) {
            setOk(true);
            const goldMsg = res.data.goldCredited
              ? ` +${res.data.goldCredited} Gold credited!`
              : '';
            setMessage(`Payment successful!${goldMsg}`);
            await client.post('/api/checkout/sync-pending').catch(() => {});
          } else if (attempts < maxAttempts) {
            attempts += 1;
            setMessage(`Waiting for confirmation… (${attempts}/${maxAttempts})`);
            setTimeout(verify, 2000);
          } else {
            setMessage('Confirmation pending. Check Billing History in a few minutes.');
          }
        })
        .catch((err) => {
          setMessage(err.response?.data?.error || 'Server connection error.');
        });
    };

    verify();
  }, [sessionId]);

  return (
    <div className="container">
      <div className="card">
        <h1>Payment Confirmation</h1>
        <p className={ok ? 'success-text' : 'warn-text'}>{message}</p>
        <p>
          <Link to="/">Game</Link> · <Link to="/billing">Billing History</Link> ·{' '}
          <Link to="/deposit">Add Funds</Link>
        </p>
      </div>
    </div>
  );
}
