import crypto from 'crypto';

/**
 * User Model / Entity
 * Encapsulates the domain entity structure and validation rules for phone-based authentication.
 */
class UserModel {
  constructor({ id, phone, password, role, name, createdAt, updatedAt }) {
    this.id = id || `usr-${crypto.randomUUID()}`;
    this.phone = (phone || '').trim();
    this.password = password; // Hashed password
    this.role = role || 'customer'; // Strictly 'customer' or 'admin'
    this.name = (name || '').trim();
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  static validateRegistration(data) {
    const { name, phone, password, confirmPassword } = data;

    if (!name || name.trim().length === 0) {
      throw new Error('Full name is required');
    }

    if (!phone || phone.trim().length < 6) {
      throw new Error('A valid phone number is required (at least 6 digits)');
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
      phone: this.phone,
      name: this.name,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return {
      id: this.id,
      phone: this.phone,
      password: this.password,
      role: this.role,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export default UserModel;
