import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Footer from './components/Footer';
import StripeModeToggle from './components/StripeModeToggle';
import NavPackageBadges from './components/NavPackageBadges';
import Home from './pages/Home';
import GamePage from './pages/GamePage';
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
        Joymed
      </Link>
      {user && (
        <>
          <Link to="/">Play</Link>
          <Link to="/bonus">Gold Rush</Link>
          <Link to="/deposit">Store</Link>
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

function Layout({ children, hideFooter = false }) {
  return (
    <div className="app-layout">
      <Nav />
      <main className="app-main">{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
}

function GameLayout() {
  return (
    <div className="app-layout app-layout-game">
      <Nav />
      <main className="app-main app-main-game">
        <GamePage />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
        <Route path="/" element={<PrivateRoute><GameLayout /></PrivateRoute>} />
        <Route path="/bonus" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
        <Route path="/deposit" element={<PrivateRoute><Layout><Deposit /></Layout></PrivateRoute>} />
        <Route path="/shop" element={<Navigate to="/deposit" replace />} />
        <Route path="/billing" element={<PrivateRoute><Layout><Billing /></Layout></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><Layout><Account /></Layout></PrivateRoute>} />
        <Route path="/login" element={<Layout hideFooter><Login /></Layout>} />
        <Route path="/register" element={<Layout hideFooter><Register /></Layout>} />
        <Route path="/verify-email" element={<VerifyEmailCallback />} />
        <Route path="/verify-email/pending" element={<PrivateRoute><Layout><VerifyEmail /></Layout></PrivateRoute>} />
        <Route path="/forgot-password" element={<Layout hideFooter><ForgotPassword /></Layout>} />
        <Route path="/reset-password" element={<Layout hideFooter><ResetPassword /></Layout>} />
        <Route path="/success" element={<PrivateRoute><Layout><Success /></Layout></PrivateRoute>} />
        <Route path="/cancel" element={<Layout><Cancel /></Layout>} />
        <Route path="/terms" element={<Layout><Terms /></Layout>} />
        <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
        <Route path="/refund-policy" element={<Layout><RefundPolicy /></Layout>} />
        <Route path="/admin/*" element={<PrivateRoute><Layout><Admin /></Layout></PrivateRoute>} />
    </Routes>
  );
}
