import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage, OrdersPage, ProfilePage, AdminPage, CustomerDashboardPage, NotFoundPage } from '../pages';
import ProtectedRoute from './ProtectedRoute';

/**
 * Main application routing configuration utilizing React Router and CASL RBAC guards.
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Home: Authentication Portal */}
      <Route path="/" element={<HomePage />} />
      <Route path="/catalog" element={<Navigate to="/dashboard" replace />} />

      {/* Protected Customer Routes via CASL RBAC */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute action="read" subject="CustomerDashboard">
            <CustomerDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/customer/*" element={<Navigate to="/dashboard" replace />} />
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
