import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import useOAuthAvailability from '../hooks/useOAuthAvailability';
import {
  ACCOUNT_SUSPENDED_CODE,
  ACCOUNT_SUSPENDED_MESSAGE,
} from '../constants/authMessages';

function oauthUrl(provider) {
  const base = API_URL || '';
  return `${base}/api/oauth/${provider}`;
}

export default function Login() {
  const { user, login, setSession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const oauth = useOAuthAvailability();

  useEffect(() => {
    const oauthError = params.get('error');
    const oauthProvider = params.get('oauth');
    if (oauthError === 'redirect_uri_mismatch') {
      setError('Social login is not configured for this environment. Please sign in with email and password.');
    } else if (oauthError === 'oauth_failed') {
      setError(`Social login failed (${oauthProvider || 'provider'}). Try email sign-in instead.`);
    } else if (oauthError === 'invalid_state') {
      setError('Social login session expired. Please try again.');
    } else if (oauthError === 'oauth_not_configured') {
      setError('Social login is not available yet. Please sign in with email and password.');
    } else if (oauthError === 'account_suspended') {
      setError(ACCOUNT_SUSPENDED_MESSAGE);
    } else if (oauthError) {
      setError('Social login failed. Please try email sign-in.');
    }

    const hash = window.location.hash.slice(1);
    if (hash.includes('token=')) {
      const hashParams = new URLSearchParams(hash);
      const token = hashParams.get('token');
      const userJson = hashParams.get('user');
      if (token && userJson) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(userJson));
          setSession(token, parsedUser);
          window.history.replaceState(null, '', '/login');
          navigate('/');
        } catch {
          setError('Social login failed');
        }
      }
    }
  }, [params, navigate, setSession]);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.code === ACCOUNT_SUSPENDED_CODE) {
        setError(ACCOUNT_SUSPENDED_MESSAGE);
      } else if (err.code === 'OAUTH_ACCOUNT') {
        setError(err.message);
      } else {
        setError(err.message || 'Sign in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Sign In</h1>
      <div className="card">
        {(oauth.google || oauth.discord) && (
          <>
            <div className="social-auth">
              {oauth.google && (
                <a href={oauthUrl('google')} className="btn btn-social btn-google">
                  Continue with Google
                </a>
              )}
              {oauth.discord && (
                <a href={oauthUrl('discord')} className="btn btn-social btn-discord">
                  Continue with Discord
                </a>
              )}
            </div>
            <p className="divider">or sign in with email</p>
          </>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <p className="hint">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="hint" style={{ marginTop: '1rem' }}>
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
