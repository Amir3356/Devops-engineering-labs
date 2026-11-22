import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loginSchema, registerSchema } from '../../utils/validators';
import { X, ShieldAlert, CheckCircle2, User, Lock, Phone } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
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
        // Zod validation for login
        const result = loginSchema.safeParse({
          phone: formData.phone,
          password: formData.password
        });
        if (!result.success) {
          setErrorMsg(result.error.issues[0]?.message || 'Invalid login details');
          setIsLoading(false);
          return;
        }

        await login(formData.phone, formData.password);
        onClose();
      } else {
        // Zod validation for register
        const result = registerSchema.safeParse(formData);
        if (!result.success) {
          setErrorMsg(result.error.issues[0]?.message || 'Invalid registration details');
          setIsLoading(false);
          return;
        }

        await register({
          name: formData.name,
          phone: formData.phone,
          password: formData.password,
          confirmPassword: formData.confirmPassword
        });
        setSuccessMsg('Account created successfully! JWT issued.');
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content auth-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

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

        {/* Form: Phone-based Authentication */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Register Mode: Full Name */}
          {!isLoginMode && (
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-with-icon">
                <User size={16} />
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          )}

          {/* Both Modes: Phone Number */}
          <div className="form-group">
            <label>Phone Number</label>
            <div className="input-with-icon">
              <Phone size={16} />
              <input
                type="tel"
                name="phone"
                placeholder="e.g. +15551234567"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Both Modes: Password */}
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
              />
            </div>
          </div>

          {/* Register Mode: Confirm Password */}
          {!isLoginMode && (
            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-with-icon">
                <Lock size={16} />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            {isLoading ? 'Authenticating with JWT...' : isLoginMode ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
