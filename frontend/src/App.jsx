import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Footer from './components/Footer';
import StripeModeToggle from './components/StripeModeToggle';
import NavPackageBadges from './components/NavPackageBadges';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Success from './pages/Success';
import Cancel from './pages/Cancel';
import Deposit from './pages/Deposit';
import Billing from './pages/Billing';
import Account from './pages/Account';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import RefundPolicy from './pages/RefundPolicy';
import VerifyEmail from './pages/VerifyEmail';
import VerifyEmailCallback from './pages/VerifyEmailCallback';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';

function Nav() {
  const { user, logout, loading } = useAuth();

  if (loading) return null;

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">
        Gold Rush Mini Game
      </Link>
      {user && (
        <>
          <Link to="/deposit">Add Funds</Link>
          <Link to="/billing">Billing</Link>
          <Link to="/account">Account</Link>
          {user.role === 'admin' && <Link to="/admin">Admin</Link>}
        </>
      )}
      <StripeModeToggle />
      <div className="nav-spacer" />
      {user ? (
        <>
          <NavPackageBadges />
          <span className="nav-user-email">{user.email}</span>
          <button
            type="button"
            className="btn-secondary btn"
            style={{ width: 'auto', margin: 0, padding: '0.4rem 0.75rem' }}
            onClick={logout}
          >
            Sign Out
          </button>
        </>
      ) : (
        <>
          <Link to="/login">Sign In</Link>
          <Link to="/register">Sign Up</Link>
        </>
      )}
    </nav>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Nav />
      <main className="app-main">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/deposit" element={<PrivateRoute><Deposit /></PrivateRoute>} />
        <Route path="/shop" element={<Navigate to="/deposit" replace />} />
        <Route path="/billing" element={<PrivateRoute><Billing /></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmailCallback />} />
        <Route path="/verify-email/pending" element={<PrivateRoute><VerifyEmail /></PrivateRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/success" element={<PrivateRoute><Success /></PrivateRoute>} />
        <Route path="/cancel" element={<Cancel />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
      </Routes>
    </Layout>
  );
}
