import crypto from 'crypto';

/**
 * Authentication Account Model
 */
class AuthAccountModel {
  constructor({ id, email, phone, password, role, name, tokenVersion, createdAt, updatedAt }) {
    this.id = id || `usr-${crypto.randomUUID()}`;
    this.email = (email || '').trim().toLowerCase();
    this.phone = (phone || '').trim();
    this.password = password; // bcrypt hashed password
    this.role = role || 'customer'; // 'customer' or 'admin'
    this.name = (name || '').trim();
    this.tokenVersion = tokenVersion !== undefined ? parseInt(tokenVersion, 10) : 1;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  static validateRegistration(data) {
    const { name, email, phone, password, confirmPassword } = data;
    const identifier = (email || phone || '').trim();

    if (!name || name.trim().length === 0) {
      throw new Error('Full name is required');
    }

    if (!identifier) {
      throw new Error('A valid email address is required');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (!confirmPassword) {
      throw new Error('Please confirm your password');
    }

    if (password !== confirmPassword) {
      throw new Error('Password and Confirm Password do not match');
    }
  }

  toSafeJSON() {
    return {
      id: this.id,
      email: this.email,
      phone: this.phone,
      name: this.name,
      role: this.role,
      tokenVersion: this.tokenVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      phone: this.phone,
      password: this.password,
      role: this.role,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export default AuthAccountModel;
