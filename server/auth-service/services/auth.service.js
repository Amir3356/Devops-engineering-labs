import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRepository from '../repositories/auth.repository.js';
import AuthAccountModel from '../models/auth.model.js';
import config from '../config/index.js';

class AuthService {
  async register(registrationData) {
    AuthAccountModel.validateRegistration(registrationData);
    const { name, email, phone, password } = registrationData;
    const identifier = (email || phone || '').trim().toLowerCase();

    const existing = await authRepository.findByIdentifier(identifier);
    if (existing) {
      const err = new Error('An account with this email address already exists');
      err.status = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const account = await authRepository.create({
      name,
      email: email ? email.trim().toLowerCase() : identifier,
      phone: phone ? phone.trim() : null,
      password: hashedPassword,
      role: 'customer' // Public registration strictly creates Customers
    });

    const token = this.generateToken(account);
    const sanitizedUser = account.toSafeJSON();

    return { user: sanitizedUser, token };
  }

  async login(credentials) {
    const { email, phone, password } = credentials;
    const identifier = (email || phone || '').trim();
    if (!identifier || !password) {
      const err = new Error('Email address and password are required');
      err.status = 400;
      throw err;
    }

    const account = await authRepository.findByIdentifier(identifier);
    if (!account) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const token = this.generateToken(account);
    const sanitizedUser = account.toSafeJSON();

    return { user: sanitizedUser, token };
  }

  generateToken(account) {
    return jwt.sign(
      {
        id: account.id,
        email: account.email,
        phone: account.phone,
        role: account.role,
        name: account.name
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN || '24h' }
    );
  }

  verify(token) {
    if (!token) {
      const err = new Error('No token provided');
      err.status = 401;
      throw err;
    }
    return jwt.verify(token, config.JWT_SECRET);
  }
}

export default new AuthService();
