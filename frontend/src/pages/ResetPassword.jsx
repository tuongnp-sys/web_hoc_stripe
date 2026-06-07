import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import PasswordStrengthMeter, { passwordStrength } from '../components/PasswordStrengthMeter';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordStrength(password).passed < 5) {
      setError('Please meet all password requirements');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await client.post('/api/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="container">
        <div className="card">
          <p className="error">Invalid reset link.</p>
          <Link to="/forgot-password">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Reset Password</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
            />
          </div>
          {message && <p className="success-text">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
        <p className="hint" style={{ marginTop: '1rem' }}>
          <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
