import { useEffect, useState } from 'react';
import client from '../api/client';

export default function useOAuthAvailability() {
  const [oauth, setOauth] = useState({ google: false, discord: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/oauth/config')
      .then((res) => {
        if (cancelled) return;
        setOauth({
          google: Boolean(res.data?.googleConfigured),
          discord: Boolean(res.data?.discordConfigured),
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setOauth({ google: false, discord: false, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return oauth;
}
