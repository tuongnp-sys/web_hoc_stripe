import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import client from '../api/client';
import InAppActionLink from '../components/InAppActionLink';
import { useAuth } from '../context/AuthContext';

function EmailDeliveryHint({ code, hint, allowedSandboxEmail }) {
  if (!hint && !allowedSandboxEmail) return null;
  return (
    <div className="banner" style={{ background: '#fef3c7', color: '#92400e' }}>
      {hint && <p style={{ margin: '0 0 0.5rem' }}>{hint}</p>}
      {code === 'RESEND_SANDBOX_RESTRICTED' && allowedSandboxEmail && (
        <p style={{ margin: 0 }}>
          Local testing: only <strong>{allowedSandboxEmail}</strong> receives inbox mail. Everyone else should use the link below.
        </p>
      )}
    </div>
  );
}

function hasStoredDevLink() {
  return Boolean(sessionStorage.getItem('devVerifyUrl'));
}

export default function VerifyEmail() {
  const { user, refreshUser, setSession } = useAuth();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [emailErrorCode, setEmailErrorCode] = useState('');
  const [allowedSandboxEmail, setAllowedSandboxEmail] = useState('');
  const [devLink, setDevLink] = useState(
    location.state?.devVerifyUrl || sessionStorage.getItem('devVerifyUrl') || ''
  );
  const [emailSent, setEmailSent] = useState(() => {
    if (location.state?.emailSent === false) return false;
    if (location.state?.devVerifyUrl || hasStoredDevLink()) return false;
    return Boolean(location.state?.emailSent);
  });

  useEffect(() => {
    if (location.state?.devVerifyUrl) {
      sessionStorage.setItem('devVerifyUrl', location.state.devVerifyUrl);
      setDevLink(location.state.devVerifyUrl);
      setEmailSent(false);
    }
    if (location.state?.emailSent === false) {
      setEmailSent(false);
    }
    if (location.state?.emailErrorHint) {
      setEmailHint(location.state.emailErrorHint);
      setEmailErrorCode(location.state.emailErrorCode || '');
      setAllowedSandboxEmail(location.state.allowedSandboxEmail || '');
    }
  }, [location.state]);

  const applyEmailResult = (data) => {
    setMessage(data.message || '');
    setEmailSent(data.emailSent === true && !data.showInAppLink);
    if (data.emailErrorHint) {
      setEmailHint(data.emailErrorHint);
      setEmailErrorCode(data.emailErrorCode || '');
      setAllowedSandboxEmail(data.allowedSandboxEmail || '');
    }
    if (data.devVerifyUrl) {
      sessionStorage.setItem('devVerifyUrl', data.devVerifyUrl);
      setDevLink(data.devVerifyUrl);
      setEmailSent(false);
    } else if (data.emailSent && !data.showInAppLink) {
      sessionStorage.removeItem('devVerifyUrl');
      setDevLink('');
    }
    if (data.token && data.user) {
      setSession(data.token, data.user);
    } else if (data.user) {
      refreshUser?.();
    }
  };

  const resend = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await client.post('/api/auth/resend-verification');
      applyEmailResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send verification');
    } finally {
      setLoading(false);
    }
  };

  const updateEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await client.post('/api/auth/update-email', { email: newEmail });
      applyEmailResult(res.data);
      setNewEmail('');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'UNDELIVERABLE_EMAIL') {
        setError(err.response?.data?.error || 'Use a real email address you can access');
      } else {
        setError(err.response?.data?.error || 'Could not update email');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearDevLink = () => {
    sessionStorage.removeItem('devVerifyUrl');
    setDevLink('');
  };

  return (
    <div className="container">
      <h1>Verify Your Email</h1>
      <div className="card">
        {user?.emailVerified ? (
          <p className="success-text">Your email is verified. You can make purchases.</p>
        ) : (
          <>
            <p>
              {devLink
                ? 'Click the verification link below to activate your account.'
                : emailSent
                  ? `We sent a link to ${user?.email}. If nothing arrives, use Resend or update your email.`
                  : `Verify ${user?.email || 'your email'} to enable purchases.`}
            </p>

            <EmailDeliveryHint
              code={emailErrorCode}
              hint={emailHint}
              allowedSandboxEmail={allowedSandboxEmail}
            />

            <InAppActionLink
              title="Verification link (24 hours)"
              url={devLink}
              onNavigate={clearDevLink}
            />

            <form onSubmit={updateEmail} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label htmlFor="newEmail">Wrong email? Update address</label>
                <input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={user?.email || 'you@gmail.com'}
                  required
                />
              </div>
              <button type="submit" className="btn" disabled={loading}>
                {loading ? 'Updating…' : 'Update & resend'}
              </button>
            </form>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={resend}
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Sending…' : 'Resend verification'}
            </button>
          </>
        )}
        {message && <p className="success-text">{message}</p>}
        {error && <p className="error">{error}</p>}
        <p className="hint" style={{ marginTop: '1rem' }}>
          <Link to="/deposit">Add Funds</Link> · <Link to="/">Back to Game</Link>
        </p>
      </div>
    </div>
  );
}
