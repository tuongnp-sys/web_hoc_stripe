import { useEffect, useState } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailCallback() {
  const [params] = useSearchParams();
  const { refreshUser, user } = useAuth();
  const [status, setStatus] = useState('');
  const token = params.get('token');

  useEffect(() => {
    if (!token) return;

    setStatus('Verifying…');
    client
      .post('/api/auth/verify-email', { token })
      .then(async () => {
        if (user) {
          await refreshUser();
        }
        sessionStorage.removeItem('devVerifyUrl');
        setStatus('Email verified successfully!');
      })
      .catch((err) => {
        setStatus(err.response?.data?.error || 'Verification failed');
      });
  }, [token, refreshUser, user]);

  if (!token) {
    return <Navigate to="/verify-email/pending" replace />;
  }

  const ok = status.includes('success');

  return (
    <div className="container">
      <div className="card">
        <h1>Email Verification</h1>
        <p className={ok ? 'success-text' : status ? 'warn-text' : 'hint'}>
          {status || 'Verifying…'}
        </p>
        {ok && (
          <p>
            {user ? (
              <Link to="/deposit">Continue to Add Funds</Link>
            ) : (
              <>
                <Link to="/login">Sign in</Link> to continue.
              </>
            )}
          </p>
        )}
        {!ok && status && status !== 'Verifying…' && (
          <p className="hint">
            <Link to="/verify-email/pending">Request a new verification link</Link>
          </p>
        )}
      </div>
    </div>
  );
}
