import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userRepository from '../repositories/user.repository.js';
import UserModel from '../models/user.model.js';
import config from '../config/index.js';
import { cached, invalidate } from '../../utils/cache.js';

// Cache keys (namespaced 'user:' by initCache).
const KEY_PROFILE = (userId) => `users:profile:${userId}`;
const KEY_CUSTOMERS = 'users:customers:all';
const clearUsers = () => invalidate('users');

class UserService {
  async register(registrationData) {
    UserModel.validateRegistration(registrationData);
    const { name, phone, password } = registrationData;

    const existingUser = await userRepository.findByPhone(phone);
    if (existingUser) {
      const err = new Error('An account with this phone number already exists');
      err.status = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await userRepository.create({
      name,
      phone: phone.trim(),
      password: hashedPassword,
      role: 'customer'
    });

    const token = this.generateToken(createdUser);
    const sanitizedUser = createdUser.toSafeJSON();

    await clearUsers(); // invalidate customer listings

    return { user: sanitizedUser, token };
  }

  async login(credentials) {
    const { phone, password } = credentials;

    if (!phone || !password) {
      const err = new Error('Phone number and password are required');
      err.status = 400;
      throw err;
    }

    const user = await userRepository.findByPhone(phone);
    if (!user) {
      const err = new Error('Invalid phone number or password');
      err.status = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error('Invalid phone number or password');
      err.status = 401;
      throw err;
    }

    const token = this.generateToken(user);
    const sanitizedUser = user.toSafeJSON();

    return { user: sanitizedUser, token };
  }

  async getProfile(userId) {
    return cached(KEY_PROFILE(userId), async () => {
      const user = await userRepository.findById(userId);
      if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }
      return user.toSafeJSON();
    });
  }

  async updateProfile(userId, updateData) {
    const allowed = {};
    if (updateData.name !== undefined) allowed.name = updateData.name;

    const updatedUser = await userRepository.update(userId, allowed);
    if (!updatedUser) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    await clearUsers(); // invalidate profile and listings immediately on commit
    return updatedUser.toSafeJSON();
  }

  async getAllCustomers() {
    return cached(KEY_CUSTOMERS, async () => {
      const allUsers = await userRepository.findAll();
      return allUsers
        .filter((u) => u.role === 'customer')
        .map((u) => u.toSafeJSON());
    });
  }

  async getUserById(userId) {
    return cached(KEY_PROFILE(userId), async () => {
      const user = await userRepository.findById(userId);
      if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }
      return user.toSafeJSON();
    });
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: user.name
      },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

export default new UserService();
