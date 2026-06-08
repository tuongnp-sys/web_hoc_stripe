import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminSessionProvider } from '../context/AdminSessionContext';
import AdminLayout from '../layouts/AdminLayout';
import UsersPage from './admin/UsersPage';
import ProductsPage from './admin/ProductsPage';
import OrdersPage from './admin/OrdersPage';
import AuditPage from './admin/AuditPage';
import WebhooksPage from './admin/WebhooksPage';
import SettingsPage from './admin/SettingsPage';

export default function Admin() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container">
        <p className="error">Admin account required.</p>
        <p className="hint">Dev: <code>admin@localhost</code> / <code>admin123456</code></p>
      </div>
    );
  }

  return (
    <AdminSessionProvider>
      <Routes>
        <Route index element={<Navigate to="users" replace />} />
        <Route
          path="users"
          element={
            <AdminLayout activeTab="users">
              <UsersPage />
            </AdminLayout>
          }
        />
        <Route
          path="products"
          element={
            <AdminLayout activeTab="products">
              <ProductsPage />
            </AdminLayout>
          }
        />
        <Route
          path="settings"
          element={
            <AdminLayout activeTab="settings">
              <SettingsPage />
            </AdminLayout>
          }
        />
        <Route
          path="orders"
          element={
            <AdminLayout activeTab="orders">
              <OrdersPage />
            </AdminLayout>
          }
        />
        <Route
          path="audit"
          element={
            <AdminLayout activeTab="audit">
              <AuditPage />
            </AdminLayout>
          }
        />
        <Route
          path="webhooks"
          element={
            <AdminLayout activeTab="webhooks">
              <WebhooksPage />
            </AdminLayout>
          }
        />
        <Route path="*" element={<Navigate to="users" replace />} />
      </Routes>
    </AdminSessionProvider>
  );
}
