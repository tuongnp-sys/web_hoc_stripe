import { useEffect, useState } from 'react';
import client from '../api/client';

const PACKAGE_LABELS = {
  gold_starter: 'Starter Pack',
  gold_popular: 'Popular Pack',
  gold_pro: 'Pro Pack',
  gold_mega: 'Mega Pack',
  premium_monthly: 'Premium',
  game_unlock: 'Game Unlock',
  premium: 'Premium',
};

function labelFor(key, description) {
  return description || PACKAGE_LABELS[key] || key;
}

export default function NavPackageBadges() {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    Promise.all([
      client.get('/api/entitlements'),
      client.get('/api/orders', { params: { limit: 50 } }),
    ])
      .then(([entRes, ordersRes]) => {
        const names = new Set();

        if (entRes.data.premium) {
          names.add('Premium');
        }
        if (entRes.data.gameUnlock) {
          names.add('Game Unlock');
        }

        for (const order of ordersRes.data.orders || []) {
          if (order.status !== 'paid') continue;
          if (order.access_enabled === false) continue;
          names.add(labelFor(order.product_key, order.description));
        }

        setPackages([...names]);
      })
      .catch(() => setPackages([]));
  }, []);

  if (!packages.length) return null;

  return (
    <span className="nav-packages" title="Active packages">
      {packages.map((name) => (
        <span key={name} className="nav-package-badge">
          {name}
        </span>
      ))}
    </span>
  );
}
