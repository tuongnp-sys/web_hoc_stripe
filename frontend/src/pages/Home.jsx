import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const LEVEL_COST = 100;

export default function Home() {
  const { user } = useAuth();
  const [goldBalance, setGoldBalance] = useState(0);
  const [level, setLevel] = useState(1);
  const [premium, setPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  const checkStatus = useCallback(async () => {
    try {
      const [walletRes, entRes] = await Promise.all([
        client.get('/api/wallet'),
        client.get('/api/entitlements'),
      ]);
      setGoldBalance(walletRes.data.goldBalance);
      setPremium(entRes.data.premium);
    } catch {
      setError('Could not connect to API. Run: cd backend && npm start');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const playLevel = async () => {
    setPlaying(true);
    setError('');
    try {
      const res = await client.post('/api/wallet/spend', {
        amount: LEVEL_COST,
        description: `Level ${level} completed`,
      });
      setGoldBalance(res.data.goldBalance);
      setLevel((l) => l + 1);
    } catch (err) {
      if (err.response?.data?.error === 'Insufficient Gold') {
        setError(`Not enough Gold. You need ${LEVEL_COST} Gold to play the next level.`);
        setGoldBalance(err.response.data.goldBalance ?? goldBalance);
      } else {
        setError(err.response?.data?.error || 'Could not play level');
      }
    } finally {
      setPlaying(false);
    }
  };

  const canPlay = goldBalance >= LEVEL_COST;

  return (
    <div className="container">
      <h1>Gold Rush Mini Game</h1>
      <div className="card">
        <p>
          Account: <code>{user?.email}</code>
        </p>
        <p className="balance-value">{goldBalance.toLocaleString()} Gold</p>
        {loading ? (
          <p className="warn-text">Loading…</p>
        ) : (
          <>
            <p>Level {level}</p>
            {premium && <p className="success-text">Premium active — bonus levels unlocked!</p>}
            {!canPlay && (
              <p className="warn-text">
                You need {LEVEL_COST} Gold to continue.{' '}
                <Link to="/deposit">Add Funds</Link>
              </p>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="btn"
          onClick={playLevel}
          disabled={loading || playing || !canPlay}
        >
          {playing ? 'Playing…' : `Play Level ${level} (${LEVEL_COST} Gold)`}
        </button>
        <p className="hint">
          <Link to="/deposit">Add Funds</Link> · <Link to="/billing">Billing</Link> ·{' '}
          <Link to="/account">Account</Link>
        </p>
      </div>
    </div>
  );
}
