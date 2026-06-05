import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Success from './pages/Success';
import Cancel from './pages/Cancel';
import Shop from './pages/Shop';
import Account from './pages/Account';
import Admin from './pages/Admin';

function Nav() {
  const { user, logout, loading } = useAuth();

  if (loading) return null;

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">
        Stripe Payment Lab
      </Link>
      {user && (
        <>
          <Link to="/shop">Cửa hàng</Link>
          <Link to="/account">Tài khoản</Link>
        </>
      )}
      <div className="nav-spacer" />
      {user ? (
        <>
          <span>{user.email}</span>
          <button
            type="button"
            className="btn-secondary btn"
            style={{ width: 'auto', margin: 0, padding: '0.4rem 0.75rem' }}
            onClick={logout}
          >
            Đăng xuất
          </button>
        </>
      ) : (
        <>
          <Link to="/login">Đăng nhập</Link>
          <Link to="/register">Đăng ký</Link>
        </>
      )}
    </nav>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Đang tải…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/shop" element={<PrivateRoute><Shop /></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/success" element={<PrivateRoute><Success /></PrivateRoute>} />
        <Route path="/cancel" element={<Cancel />} />
        {import.meta.env.DEV && <Route path="/admin" element={<Admin />} />}
      </Routes>
    </>
  );
}
