import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { useAdminSession } from '../../context/AdminSessionContext';

export default function SettingsPage() {
  const { capabilities } = useAdminSession();
  const [windowHours, setWindowHours] = useState('48');
  const [minHours, setMinHours] = useState(1);
  const [maxHours, setMaxHours] = useState(168);
  const [previewSections, setPreviewSections] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/admin/settings/refund-policy');
      setWindowHours(String(res.data.windowHours));
      setMinHours(res.data.minWindowHours ?? 1);
      setMaxHours(res.data.maxWindowHours ?? 168);
      setPreviewSections(res.data.previewSections || []);
      setUpdatedAt(res.data.updatedAt);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setFlash('');
    setError('');
    try {
      const res = await client.patch('/api/admin/settings/refund-policy', {
        windowHours: Number(windowHours),
      });
      setWindowHours(String(res.data.windowHours));
      setPreviewSections(
        (res.data.policy?.sections || []).filter((s) =>
          ['2. Eligibility Window', '6. Non-Refundable Items'].includes(s.heading)
        )
      );
      setUpdatedAt(res.data.updatedAt);
      setFlash('Refund policy settings saved');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="hint">Loading settings…</p>;
  }

  return (
    <div>
      <p className="hint admin-products-note">
        Changes apply immediately to new refund requests and the public{' '}
        <Link to="/refund-policy">Refund Policy</Link> page.
      </p>

      {flash && <p className="admin-flash admin-flash-success">{flash}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card admin-settings-card">
        <h2 className="admin-section-title" style={{ marginTop: 0 }}>
          Refund Policy
        </h2>
        {updatedAt && (
          <p className="hint">Last updated: {new Date(updatedAt).toLocaleString()}</p>
        )}

        <div className="form-group">
          <label htmlFor="refund-window-hours">Refund eligibility window (hours)</label>
          <input
            id="refund-window-hours"
            type="number"
            min={minHours}
            max={maxHours}
            step="1"
            value={windowHours}
            disabled={!capabilities?.canEdit}
            onChange={(e) => setWindowHours(e.target.value)}
          />
          <p className="hint">
            Allowed range: {minHours}–{maxHours} hours. Gold purchases must have unspent Gold and
            status &quot;Succeeded&quot; within this window.
          </p>
        </div>

        {previewSections.length > 0 && (
          <div className="admin-policy-preview">
            <h3 className="admin-section-title">Policy preview</h3>
            {previewSections.map((section) => (
              <div key={section.heading} className="admin-policy-preview-section">
                <strong>{section.heading}</strong>
                <p className="hint">{section.body}</p>
              </div>
            ))}
          </div>
        )}

        {capabilities?.canEdit && (
          <button type="button" className="btn" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}
