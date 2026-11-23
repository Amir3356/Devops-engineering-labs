import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loginSchema, registerSchema } from '../../utils/validators';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  CheckCircle2,
  User,
  Lock,
  Mail,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Compass,
  ShoppingBag,
  Activity,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';

const HIGHLIGHTS = [
  'Instant & Reliable Order Processing',
  'Live Order Tracking & Notifications',
  'Event Trail of Every Transaction'
];

function AuthShell({ children }) {
  return (
    <div className="auth-split-card">
      <section className="auth-brand-panel">
        <div className="auth-brand-top">
          <div className="auth-brand-row">
            <div className="auth-brand-icon"><ShoppingBag size={22} /></div>
            <span className="auth-brand-name">NexusCommerce</span>
          </div>
          <span className="auth-brand-pill">
            <Activity size={13} /> Microservices · Event-Driven Commerce
          </span>
        </div>

        <div className="auth-brand-body">
          <h1>Shop, Order &amp; Track in Real Time</h1>
          <p>
            Browse the catalog, place orders and follow every item as it moves
            through inventory and delivery — customers and administrators in one place.
          </p>
          <ul className="auth-highlights">
            {HIGHLIGHTS.map(item => (
              <li key={item}><CheckCircle2 size={17} /> {item}</li>
            ))}
          </ul>
        </div>

        <div className="auth-brand-footer">
          <span>© 2026 NexusCommerce Platform</span>
          <span className="auth-brand-footer-badge"><ShieldCheck size={13} /> RBAC Protected</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-inner">{children}</div>
      </section>
    </div>
  );
}

export default function AuthCard() {
  const { user, isAuthenticated, isAdmin, login, register, logout } = useAuth();
  const navigate = useNavigate();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State: Email-based authentication
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLoginMode) {
        const result = loginSchema.safeParse({
          email: formData.email,
          password: formData.password
        });
        if (!result.success) {
          setErrorMsg(result.error.issues[0]?.message || 'Invalid login details');
          setIsLoading(false);
          return;
        }

        const res = await login(formData.email, formData.password);
        if (res.user?.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      } else {
        const result = registerSchema.safeParse(formData);
        if (!result.success) {
          setErrorMsg(result.error.issues[0]?.message || 'Invalid registration details');
          setIsLoading(false);
          return;
        }

        await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword
        });
        setSuccessMsg('Account created successfully! You are now signed in.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (loginMode) => {
    setIsLoginMode(loginMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  // If already authenticated, display current session status
  if (isAuthenticated && user) {
    return (
      <AuthShell>
        <div className="auth-card-header">
          <div className="auth-badge-icon">
            <ShieldCheck size={26} className="text-emerald" />
          </div>
          <h2>You're Signed In</h2>
          <p className="auth-card-subtitle">Your session is active on the platform</p>
        </div>

        <div className="session-user-details">
          <div className="session-info-row">
            <span className="session-label">Full Name</span>
            <span className="session-value">{user.name}</span>
          </div>
          <div className="session-info-row">
            <span className="session-label">Email Address</span>
            <span className="session-value">{user.email || user.phone}</span>
          </div>
          <div className="session-info-row">
            <span className="session-label">Role</span>
            <span className={`user-role-tag ${user.role}`}>
              {user.role === 'admin' ? <ShieldCheck size={12} /> : null}
              {user.role}
            </span>
          </div>
        </div>

        <div className="session-actions">
          {isAdmin ? (
            <button className="auth-submit-btn" onClick={() => navigate('/admin/dashboard')}>
              <LayoutDashboard size={18} />
              Open Admin Dashboard
            </button>
          ) : (
            <button className="auth-submit-btn" onClick={() => navigate('/dashboard')}>
              <Compass size={18} />
              Open Customer Dashboard
            </button>
          )}

          <button className="btn-session-logout" onClick={logout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </AuthShell>
    );
  }

  // Not authenticated: Display Sign In / Register form
  return (
    <AuthShell>
      <div className="auth-card-header">
        <h2>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="auth-card-subtitle">
          {isLoginMode ? 'Sign in to access your NexusCommerce portal' : 'Register a customer account to start shopping'}
        </p>
      </div>

      {errorMsg && (
        <div className="auth-alert error">
          <ShieldAlert size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="auth-alert success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        {!isLoginMode && (
          <div className="form-group">
            <label htmlFor="auth-name">Full Name</label>
            <div className="input-with-icon">
              <User size={16} />
              <input
                id="auth-name"
                type="text"
                name="name"
                placeholder="e.g. Abebe Bikila"
                value={formData.name}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="auth-email">Email Address</label>
          <div className="input-with-icon">
            <Mail size={16} />
            <input
              id="auth-email"
              type="email"
              name="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="auth-password">Password</label>
          <div className="input-with-icon">
            <Lock size={16} />
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete={isLoginMode ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="input-icon-btn"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {!isLoginMode && (
          <div className="form-group">
            <label htmlFor="auth-confirm">Confirm Password</label>
            <div className="input-with-icon">
              <Lock size={16} />
              <input
                id="auth-confirm"
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        <button type="submit" className="auth-submit-btn" disabled={isLoading}>
          {isLoading
            ? (isLoginMode ? 'Signing in...' : 'Creating account...')
            : (isLoginMode ? 'Sign In' : 'Create Account')}
          {!isLoading && <ArrowRight size={17} />}
        </button>
      </form>

      <p className="auth-switch-text">
        {isLoginMode ? "Don't have an account? " : 'Already have an account? '}
        <button type="button" className="auth-switch-link" onClick={() => switchMode(!isLoginMode)}>
          {isLoginMode ? 'Sign up' : 'Sign in'}
        </button>
      </p>

      <p className="auth-rbac-note">
        <ShieldCheck size={14} /> Role-Based Access Control (RBAC) Protected
      </p>
    </AuthShell>
  );
}
