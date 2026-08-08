const { error } = require('utils/logger');
const usersModel = require('models/users');
const rolesModel = require('models/roles');
const authService = require('services/auth');

module.exports = {
  getAll: async ({ page = 1, limit = 10, status } = {}) => {
    try {
      const result = await usersModel.getAll({ page, limit, status });
      if (!result) {
        return { ok: false, msg: 'Unable to fetch users.' };
      }
      return { ok: true, data: result };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  create: async ({ userData }) => {
    try {
      const role = await rolesModel.getById({ roleId: userData.roleId });
      if (!role || role.status !== 'active') {
        return { ok: false, msg: 'Invalid role' };
      }

      const existingUser = await usersModel.findByEmail({ email: userData.email });
      if (existingUser) {
        return { ok: false, msg: 'Email already exists', duplicate: true };
      }

      const passwordHash = await authService.hashPassword(userData.password);
      const user = await usersModel.createUser({
        userData: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          fullName: `${userData.firstName} ${userData.lastName}`.trim(),
          email: userData.email.toLowerCase(),
          passwordHash,
          roleId: userData.roleId,
          status: userData.status || 'active',
          createdBy: userData.createdBy
        }
      });

      const userWithRole = await usersModel.getByIdWithRole({ userId: user._id });
      return { ok: true, data: userWithRole };
    } catch (e) {
      error(e);
      if (e.code === 11000) {
        return { ok: false, msg: 'Email already exists', duplicate: true };
      }
      if (e.name === 'ValidationError') {
        return { ok: false, msg: e.message };
      }
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  patch: async ({ userId, updateData }) => {
    try {
      const existingUser = await usersModel.getById({ userId });
      if (!existingUser) {
        return { ok: false, msg: 'User not found' };
      }

      const patchPayload = { ...updateData };

      if (patchPayload.roleId) {
        const role = await rolesModel.getById({ roleId: patchPayload.roleId });
        if (!role || role.status !== 'active') {
          return { ok: false, msg: 'Invalid role' };
        }
      }

      if (patchPayload.email) {
        const emailUser = await usersModel.findByEmail({ email: patchPayload.email });
        if (emailUser && emailUser._id.toString() !== userId.toString()) {
          return { ok: false, msg: 'Email already exists', duplicate: true };
        }
        patchPayload.email = patchPayload.email.toLowerCase();
      }

      if (patchPayload.password) {
        patchPayload.passwordHash = await authService.hashPassword(patchPayload.password);
        delete patchPayload.password;
      }

      const user = await usersModel.patchUser({ userId, updateData: patchPayload });
      if (!user) {
        return { ok: false, msg: 'User not found or unable to update.' };
      }
      return { ok: true, data: user };
    } catch (e) {
      error(e);
      if (e.code === 11000) {
        return { ok: false, msg: 'Email already exists', duplicate: true };
      }
      if (e.name === 'ValidationError') {
        return { ok: false, msg: e.message };
      }
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  }
};
