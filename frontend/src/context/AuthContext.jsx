import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';
import { ACCOUNT_SUSPENDED_CODE } from '../constants/authMessages';

const AuthContext = createContext(null);

function apiErrorMessage(err, fallback) {
  return err.response?.data?.error || err.message || fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const res = await client.get('/api/auth/me');
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      if (err.response?.data?.code === ACCOUNT_SUSPENDED_CODE) {
        logout();
      }
      throw err;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    refreshUser()
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const setSession = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const login = async (email, password) => {
    try {
      const res = await client.post('/api/auth/login', { email, password });
      setSession(res.data.token, res.data.user);
      return res.data;
    } catch (err) {
      const e = new Error(apiErrorMessage(err, 'Sign in failed'));
      e.code = err.response?.data?.code;
      throw e;
    }
  };

  const register = async (email, password, confirmPassword, acceptTerms, confirmAge) => {
    try {
      const res = await client.post('/api/auth/register', {
        email,
        password,
        confirmPassword,
        acceptTerms,
        confirmAge,
      });
      setSession(res.data.token, res.data.user);
      return res.data;
    } catch (err) {
      const e = new Error(apiErrorMessage(err, 'Registration failed'));
      e.code = err.response?.data?.code;
      throw e;
    }
  };

  const updateEmail = async (email) => {
    try {
      const res = await client.post('/api/auth/update-email', { email });
      if (res.data.token && res.data.user) {
        setSession(res.data.token, res.data.user);
      }
      return res.data;
    } catch (err) {
      throw new Error(apiErrorMessage(err, 'Could not update email'));
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setSession, refreshUser, updateEmail }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
