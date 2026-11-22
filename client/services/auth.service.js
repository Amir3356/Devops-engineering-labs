import { loginApi, registerApi, logoutApi, getProfileApi, updateProfileApi } from '../api/auth.api';

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
  }

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
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

  async login(phone, password) {
    const res = await loginApi({ phone, password });
    if (res.success && res.data) {
      const { user, token } = res.data;
      this.setToken(token);
      this.setUser(user);
      return { success: true, user, token };
    }
    throw new Error(res.message || 'Login failed');
  }

  async register({ name, phone, password, confirmPassword }) {
    if (password !== confirmPassword) {
      throw new Error('Password and Confirm Password do not match');
    }

    const res = await registerApi({ name, phone, password, confirmPassword });
    if (res.success && res.data) {
      const { user, token } = res.data;
      this.setToken(token);
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
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await getProfileApi();
      if (res.success && res.data) {
        this.setUser(res.data);
        return res.data;
      }
    } catch {
      // Return cached user if network fails
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
