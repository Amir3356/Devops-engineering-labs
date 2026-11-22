import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAbility } from '../context/AbilityContext';

/**
 * Route guard component enforcing CASL RBAC permissions on routes.
 * @param {string} action - 'read' | 'manage' | 'create'
 * @param {string} subject - Resource name e.g. 'Order', 'Profile', 'AdminDashboard'
 */
export default function ProtectedRoute({ children, adminOnly = false, action, subject }) {
  const { isAuthenticated } = useAuth();
  const ability = useAbility();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // CASL RBAC Permission Check
  if (action && subject) {
    if (!ability.can(action, subject)) {
      return <Navigate to="/" replace />;
    }
  } else if (adminOnly) {
    if (!ability.can('manage', 'AdminDashboard')) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
