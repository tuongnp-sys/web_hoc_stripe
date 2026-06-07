import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PasswordStrengthMeter, { passwordStrength } from '../components/PasswordStrengthMeter';

function oauthUrl(provider) {
  const base = API_URL || '';
  return `${base}/api/oauth/${provider}`;
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordStrength(password).passed < 5) {
      setError('Please meet all password requirements');
      return;
    }
    if (!acceptTerms) {
      setError('You must accept the Terms of Service and Privacy Policy');
      return;
    }
    if (!confirmAge) {
      setError('You must confirm you are at least 13 years old');
      return;
    }

    setLoading(true);
    try {
      const data = await register(email, password, confirmPassword, acceptTerms, confirmAge);
      navigate('/verify-email/pending', {
        state: {
          devVerifyUrl: data.devVerifyUrl || null,
          emailSent: data.emailSent,
          emailErrorCode: data.emailErrorCode,
          emailErrorHint: data.emailErrorHint,
          allowedSandboxEmail: data.allowedSandboxEmail,
        },
      });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Create Account</h1>
      <div className="card">
        <div className="social-auth">
          <a href={oauthUrl('google')} className="btn btn-social btn-google">
            Continue with Google
          </a>
          <a href={oauthUrl('discord')} className="btn btn-social btn-discord">
            Continue with Discord
          </a>
        </div>
        <p className="divider">or sign up with email</p>
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
              placeholder="you@gmail.com"
            />
            <p className="hint" style={{ marginTop: '0.35rem' }}>
              Use a <strong>real email</strong> you can access — verification is required for purchases.
              Fake domains (e.g. test@lab.local) cannot receive mail.
            </p>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              I agree to the{' '}
              <Link to="/terms" target="_blank">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank">
                Privacy Policy
              </Link>
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={confirmAge}
                onChange={(e) => setConfirmAge(e.target.checked)}
              />
              I confirm I am at least 13 years old
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>
        <p className="hint" style={{ marginTop: '1rem' }}>
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
