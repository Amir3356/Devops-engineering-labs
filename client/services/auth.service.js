import { loginApi, registerApi, logoutApi, getProfileApi, updateProfileApi } from '../api/auth.api';
import { refreshRealtimeAuth } from './realtime.service';

const TOKEN_KEY = 'ecommerce_token';
const USER_KEY = 'ecommerce_user';

/**
 * Authentication Business Logic Service (Frontend)
 */
class AuthService {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
    refreshRealtimeAuth(); // the WebSocket now receives this user's notifications
  }

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    refreshRealtimeAuth(); // stop delivering the previous user's notifications
  }

  getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  removeUser() {
    localStorage.removeItem(USER_KEY);
  }

  async login(email, password) {
    const payload = typeof email === 'object' ? email : { email, password };
    const res = await loginApi(payload);
    if (res.success && res.data) {
      const { user, token } = res.data;
      // Token is securely handled via HttpOnly cookie; user info kept for UI context
      this.setUser(user);
      return { success: true, user, token };
    }
    throw new Error(res.message || 'Login failed');
  }

  async register({ name, email, password, confirmPassword }) {
    if (password !== confirmPassword) {
      throw new Error('Password and Confirm Password do not match');
    }

    const res = await registerApi({ name, email, password, confirmPassword });
    if (res.success && res.data) {
      const { user, token } = res.data;
      // Token is securely handled via HttpOnly cookie
      this.setUser(user);
      return { success: true, user, token };
    }
    throw new Error(res.message || 'Registration failed');
  }

  async logout() {
    try {
      await logoutApi();
    } catch {
      // Ignore network errors on logout
    }
    this.removeToken();
    this.removeUser();
  }

  async syncProfile() {
    try {
      const res = await getProfileApi();
      if (res.success && res.data) {
        this.setUser(res.data);
        return res.data;
      }
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        this.removeUser();
        this.removeToken();
        return null;
      }
    }
    return this.getUser();
  }

  async updateProfile(profileData) {
    const res = await updateProfileApi(profileData);
    if (res.success && res.data) {
      this.setUser(res.data);
      return res.data;
    }
    throw new Error(res.message || 'Failed to update profile');
  }
}

export default new AuthService();
