import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loginSchema, registerSchema } from '../../utils/validators';
import { X, ShieldAlert, CheckCircle2, User, Lock, Mail } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
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

  if (!isOpen) return null;

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

        await login(formData.email, formData.password);
        onClose();
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
        setSuccessMsg('Account created successfully!');
        setTimeout(() => onClose(), 1200);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content auth-modal">
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="auth-modal-header">
          <h2>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLoginMode ? 'Sign in with your email to continue' : 'Sign up to start shopping'}</p>
        </div>

        {/* Tab switcher */}
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
            Register
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
              ? (isLoginMode ? 'Signing in...' : 'Registering...')
              : (isLoginMode ? 'Sign In' : 'Create Account')
            }
          </button>
        </form>
      </div>
    </div>
  );
}
