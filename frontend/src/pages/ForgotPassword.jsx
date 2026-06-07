import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import InAppActionLink from '../components/InAppActionLink';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devLink, setDevLink] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const applyResult = (data) => {
    setMessage(data.message || '');
    setEmailHint(data.emailErrorHint || '');
    setNotFound(Boolean(data.notFound));
    setDevLink(data.devResetUrl || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setDevLink('');
    setEmailHint('');
    setNotFound(false);
    try {
      const res = await client.post('/api/auth/forgot-password', { email });
      applyResult(res.data);
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'OAUTH_ACCOUNT') {
        setError(err.response?.data?.error || 'This account uses social login — password reset is not available.');
      } else if (code === 'UNDELIVERABLE_EMAIL') {
        setError(err.response?.data?.error || 'Use a real email address you registered with.');
      } else {
        setError(err.response?.data?.error || 'Request failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Forgot Password</h1>
      <div className="card">
        <p className="hint">
          Enter the email you used to sign up. If email delivery is unavailable, the reset link will appear on this page.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@gmail.com"
            />
          </div>

          {message && <p className="success-text">{message}</p>}
          {notFound && (
            <p className="warn-text">
              No account found for this email. Check spelling or{' '}
              <Link to="/register">create an account</Link>.
            </p>
          )}
          {emailHint && (
            <p className="warn-text" style={{ fontSize: '0.9rem' }}>
              {emailHint}
            </p>
          )}

          <InAppActionLink title="Password reset link (15 minutes)" url={devLink} />

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
        <p className="hint" style={{ marginTop: '1rem' }}>
          <Link to="/login">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
