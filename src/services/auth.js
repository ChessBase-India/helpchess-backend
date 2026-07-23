const bcrypt = require('bcryptjs');
const config = require('config');
const jwt = require('jsonwebtoken');

const { error } = require('utils/logger');
const usersModel = require('models/users');

const SALT_ROUNDS = 10;

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  return safeUser;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

module.exports = {
  login: async ({ email, password }) => {
    try {
      if (!email || !isValidEmail(email)) {
        return { ok: false, msg: 'Invalid credentials', unauthorized: true };
      }
      if (!password || typeof password !== 'string' || password.length === 0) {
        return { ok: false, msg: 'Invalid credentials', unauthorized: true };
      }

      const user = await usersModel.findByEmail({ email });
      if (!user) {
        return { ok: false, msg: 'Invalid credentials', unauthorized: true };
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return { ok: false, msg: 'Invalid credentials', unauthorized: true };
      }

      if (user.status !== 'active') {
        return { ok: false, msg: 'Account is not active', unauthorized: true };
      }

      await usersModel.updateLastLogin({ userId: user._id });
      const userWithRole = await usersModel.getByIdWithRole({ userId: user._id });

      return { ok: true, data: { user: sanitizeUser(userWithRole), userId: user._id.toString() } };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  refresh: async ({ refreshToken }) => {
    try {
      if (!refreshToken) {
        return { ok: false, msg: 'Authentication Failed', unauthorized: true };
      }

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, config.get('refreshJwtSecret'));
      } catch (jwtError) {
        return { ok: false, msg: 'Authentication Failed', unauthorized: true };
      }

      const user = await usersModel.getById({ userId: decoded.userId });
      if (!user || user.status !== 'active') {
        return { ok: false, msg: 'Authentication Failed', unauthorized: true };
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
      return { ok: true, data: sanitizeUser(user) };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  hashPassword: async (password) => bcrypt.hash(password, SALT_ROUNDS),

  isValidEmail
};
