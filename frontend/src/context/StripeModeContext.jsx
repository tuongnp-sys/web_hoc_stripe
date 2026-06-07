import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const STORAGE_KEY = 'stripe_mode';

const StripeModeContext = createContext(null);

export function StripeModeProvider({ children }) {
  const [mode, setModeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'test');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshConfig = useCallback(() => {
    return client.get('/api/stripe/config').then((res) => {
      setConfig(res.data);
      return res.data;
    });
  }, []);

  useEffect(() => {
    refreshConfig()
      .catch(() => setConfig({ testAvailable: true, liveAvailable: false, liveBlockers: [] }))
      .finally(() => setLoading(false));
  }, [refreshConfig]);

  const setMode = useCallback(
    (next) => {
      const value = next === 'live' ? 'live' : 'test';
      if (value === 'live' && config && !config.liveAvailable) {
        return false;
      }
      localStorage.setItem(STORAGE_KEY, value);
      setModeState(value);
      return true;
    },
    [config]
  );

  useEffect(() => {
    if (config && mode === 'live' && !config.liveAvailable) {
      localStorage.setItem(STORAGE_KEY, 'test');
      setModeState('test');
    }
  }, [config, mode]);

  return (
    <StripeModeContext.Provider value={{ mode, setMode, config, loading, refreshConfig }}>
      {children}
    </StripeModeContext.Provider>
  );
}

export function useStripeMode() {
  const ctx = useContext(StripeModeContext);
  if (!ctx) throw new Error('useStripeMode must be used within StripeModeProvider');
  return ctx;
}
