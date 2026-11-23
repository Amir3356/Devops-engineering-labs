import React, { useState } from 'react';
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
  Compass
} from 'lucide-react';

export default function AuthCard() {
  const { user, isAuthenticated, isAdmin, login, register, logout } = useAuth();
  const navigate = useNavigate();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  // If already authenticated, display current session status
  if (isAuthenticated && user) {
    return (
      <div className="auth-page-card authenticated-session-card">
        <div className="auth-card-header">
          <div className="auth-badge-icon">
            <ShieldCheck size={28} className="text-emerald" />
          </div>
          <h2>Authenticated Session</h2>
          <p className="auth-card-subtitle">You are signed in to the platform</p>
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
            <button
              className="auth-submit-btn"
              onClick={() => navigate('/admin/dashboard')}
            >
              <LayoutDashboard size={18} />
              Open Admin Dashboard
            </button>
          ) : (
            <button
              className="auth-submit-btn"
              onClick={() => navigate('/dashboard')}
            >
              <Compass size={18} />
              Open Customer Dashboard
            </button>
          )}

          <button className="btn-session-logout" onClick={logout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated: Display Sign In / Register Card
  return (
    <div className="auth-page-card">
      <div className="auth-card-header">
        <h2>Welcome to NexusCommerce</h2>
        <p className="auth-card-subtitle">Sign in with your email or create an account</p>
      </div>

      {/* Tab Switcher */}
      <div className="auth-tab-row">
        <button
          type="button"
          className={`auth-tab-btn ${isLoginMode ? 'active' : ''}`}
          onClick={() => { setIsLoginMode(true); setErrorMsg(''); }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`auth-tab-btn ${!isLoginMode ? 'active' : ''}`}
          onClick={() => { setIsLoginMode(false); setErrorMsg(''); }}
        >
          Register Account
        </button>
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

      {/* Email-based Authentication Form */}
      <form onSubmit={handleSubmit} className="auth-form">
        {!isLoginMode && (
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-with-icon">
              <User size={16} />
              <input
                type="text"
                name="name"
                placeholder="e.g. Abebe Bikila"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        )}

        {/* Email Address Field */}
        <div className="form-group">
          <label>Email Address</label>
          <div className="input-with-icon">
            <Mail size={16} />
            <input
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
          <label>Password</label>
          <div className="input-with-icon">
            <Lock size={16} />
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete={isLoginMode ? 'current-password' : 'new-password'}
            />
          </div>
        </div>

        {!isLoginMode && (
          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-with-icon">
              <Lock size={16} />
              <input
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading
            ? (isLoginMode ? 'Signing in...' : 'Creating account...')
            : (isLoginMode ? 'Sign In to Account' : 'Create Customer Account')
          }
        </button>
      </form>
    </div>
  );
}
