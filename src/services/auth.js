const bcrypt = require('bcryptjs');
const config = require('config');
const jwt = require('jsonwebtoken');

const { error } = require('utils/logger');
const usersModel = require('models/users');

const SALT_ROUNDS = 10;
const AUTH_FAILED = 'AUTH_FAILED';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const authFailure = (msg) => ({ ok: false, msg, code: AUTH_FAILED });

module.exports = {
  AUTH_FAILED,

  login: async ({ email, password }) => {
    try {
      if (!email || !isValidEmail(email)) {
        return authFailure('Invalid credentials');
      }
      if (!password || typeof password !== 'string' || password.length === 0) {
        return authFailure('Invalid credentials');
      }

      const user = await usersModel.findByEmailForAuth({ email });
      if (!user) {
        return authFailure('Invalid credentials');
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return authFailure('Invalid credentials');
      }

      if (user.status !== 'active') {
        return authFailure('Account is not active');
      }

      await usersModel.updateLastLogin({ userId: user._id });
      const userWithRole = await usersModel.getByIdWithRole({ userId: user._id });

      return { ok: true, data: { user: userWithRole, userId: user._id.toString() } };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  refresh: async ({ refreshToken }) => {
    try {
      if (!refreshToken) {
        return authFailure('Authentication Failed');
      }

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, config.get('refreshJwtSecret'));
      } catch (jwtError) {
        return authFailure('Authentication Failed');
      }

      const user = await usersModel.getById({ userId: decoded.userId });
      if (!user || user.status !== 'active') {
        return authFailure('Authentication Failed');
      }

      return { ok: true, data: { userId: user._id.toString() } };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  getMe: async ({ userId }) => {
    try {
      const user = await usersModel.getByIdWithRole({ userId });
      if (!user) {
        return { ok: false, msg: 'User not found' };
      }
      return { ok: true, data: user };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  hashPassword: async (password) => bcrypt.hash(password, SALT_ROUNDS),

  isValidEmail
};
