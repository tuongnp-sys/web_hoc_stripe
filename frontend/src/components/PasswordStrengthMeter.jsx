const RULES = [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[a-z]/.test(p), label: 'Lowercase letter' },
  { test: (p) => /[A-Z]/.test(p), label: 'Uppercase letter' },
  { test: (p) => /\d/.test(p), label: 'Number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'Special character' },
];

export function passwordStrength(password) {
  const passed = RULES.filter((r) => r.test(password)).length;
  return { passed, total: RULES.length, rules: RULES.map((r) => ({ ...r, ok: r.test(password) })) };
}

export default function PasswordStrengthMeter({ password }) {
  const { passed, total, rules } = passwordStrength(password);
  const pct = (passed / total) * 100;
  const level = passed <= 2 ? 'weak' : passed <= 4 ? 'medium' : 'strong';

  if (!password) return null;

  return (
    <div className="password-strength">
      <div className="strength-bar" aria-hidden="true">
        <div className={`strength-fill strength-${level}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="strength-rules">
        {rules.map((r) => (
          <li key={r.label} className={r.ok ? 'rule-ok' : 'rule-pending'}>
            {r.ok ? '✓' : '○'} {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
