import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRepository from '../repositories/auth.repository.js';
import AuthAccountModel from '../models/auth.model.js';
import config from '../config/index.js';

class AuthService {
  async register(registrationData) {
    AuthAccountModel.validateRegistration(registrationData);
    const { name, phone, password } = registrationData;

    const existing = await authRepository.findByPhone(phone);
    if (existing) {
      const err = new Error('An account with this phone number already exists');
      err.status = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const account = await authRepository.create({
      name,
      phone: phone.trim(),
      password: hashedPassword,
      role: 'customer' // Public registration strictly creates Customers
    });

    const token = this.generateToken(account);
    const sanitizedUser = account.toSafeJSON();

    return { user: sanitizedUser, token };
  }

  async login(credentials) {
    const { phone, password } = credentials;
    if (!phone || !password) {
      const err = new Error('Phone number and password are required');
      err.status = 400;
      throw err;
    }

    const account = await authRepository.findByPhone(phone);
    if (!account) {
      const err = new Error('Invalid phone number or password');
      err.status = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      const err = new Error('Invalid phone number or password');
      err.status = 401;
      throw err;
    }

    const token = this.generateToken(account);
    const sanitizedUser = account.toSafeJSON();

    return { user: sanitizedUser, token };
  }

  verify(token) {
    if (!token) {
      const err = new Error('Token is required');
      err.status = 400;
      throw err;
    }
    const decoded = jwt.verify(token, config.JWT_SECRET);
    return { valid: true, user: decoded };
  }

  generateToken(account) {
    return jwt.sign(
      {
        id: account.id,
        phone: account.phone,
        role: account.role,
        name: account.name
      },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

export default new AuthService();
