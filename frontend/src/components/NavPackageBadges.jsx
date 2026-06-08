import { useEffect, useState } from 'react';
import client from '../api/client';

export default function NavPackageBadges() {
  const [energy, setEnergy] = useState(null);
  const [gold, setGold] = useState(null);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    Promise.all([
      client.get('/api/game/profile').catch(() => ({ data: {} })),
      client.get('/api/wallet').catch(() => ({ data: { goldBalance: 0 } })),
      client.get('/api/entitlements').catch(() => ({ data: { premium: false } })),
    ]).then(([gameRes, walletRes, entRes]) => {
      setEnergy(gameRes.data.energy);
      setGold(walletRes.data.goldBalance);
      setIsVip(Boolean(entRes.data.premium || gameRes.data.isVip));
    });
  }, []);

  return (
    <span className="nav-packages" title="Balances">
      {isVip && <span className="nav-package-badge nav-badge-vip">VIP</span>}
      {energy !== null && !isVip && (
        <span className="nav-package-badge">⚡ {energy}</span>
      )}
      {gold !== null && gold > 0 && (
        <span className="nav-package-badge">🪙 {gold.toLocaleString()}</span>
      )}
    </span>
  );
}
