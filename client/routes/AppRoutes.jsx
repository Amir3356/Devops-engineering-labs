import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage, OrdersPage, ProfilePage, AdminPage, NotFoundPage } from '../pages';
import ProtectedRoute from './ProtectedRoute';

/**
 * Main application routing configuration utilizing React Router and CASL RBAC guards.
 */
export default function AppRoutes({ onSelectProduct }) {
  return (
    <Routes>
      {/* Public Home & Catalog */}
      <Route path="/" element={<HomePage onSelectProduct={onSelectProduct} />} />
      <Route path="/catalog" element={<Navigate to="/" replace />} />

      {/* Protected Customer Routes via CASL RBAC */}
      <Route
        path="/orders"
        element={
          <ProtectedRoute action="read" subject="Order">
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute action="manage" subject="Profile">
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Protected Administrator Routes via CASL RBAC */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute action="manage" subject="AdminDashboard">
            <AdminPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
