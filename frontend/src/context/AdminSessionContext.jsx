import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AdminSessionContext = createContext(null);

export function AdminSessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/api/admin/session');
      setSession(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Cannot load admin session');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AdminSessionContext.Provider value={{ session, loading, error, refresh, capabilities: session?.capabilities }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
