import { Link } from 'react-router-dom';
import { useStripeMode } from '../context/StripeModeContext';

export default function StripeModeToggle() {
  const { mode, setMode, config, loading } = useStripeMode();

  if (loading || !config) return null;

  const liveReady = config.liveAvailable;

  return (
    <div className="stripe-mode-toggle" title="Stripe test vs live mode">
      <span className={`mode-badge ${mode === 'test' ? 'mode-test' : 'mode-live'}`}>
        {mode === 'test' ? 'TEST' : 'LIVE'}
      </span>
      <label className="toggle-label">
        <input
          type="checkbox"
          checked={mode === 'live'}
          disabled={!liveReady}
          onChange={(e) => setMode(e.target.checked ? 'live' : 'test')}
        />
        <span>Live mode</span>
      </label>
      {!liveReady && (
        <Link to="/billing" className="hint" style={{ fontSize: '0.75rem' }}>
          Live checklist
        </Link>
      )}
    </div>
  );
}
