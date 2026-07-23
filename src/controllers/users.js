const { isValidObjectId } = require('mongoose');

const { error } = require('utils/logger');
const usersService = require('services/users');
const authService = require('services/auth');

const VALID_STATUSES = ['active', 'inactive', 'suspended'];

module.exports = {
  getAll: async (req, res) => {
    try {
      const { pageSize, page, status } = req.query;
      if (pageSize && (Number.isNaN(Number(pageSize)) || pageSize <= 0 || pageSize > 100)) {
        return res.invalid({ msg: 'Invalid pageSize' });
      }
      if (page && (Number.isNaN(Number(page)) || page <= 0)) {
        return res.invalid({ msg: 'Invalid page' });
      }
      if (status && !VALID_STATUSES.includes(status)) {
        return res.invalid({ msg: 'Invalid status' });
      }

      const response = await usersService.getAll({
        limit: pageSize ? parseInt(pageSize, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined,
        status
      });
      if (!response.ok || !response.data) {
        return res.failure({ msg: 'Unable to fetch users!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  create: async (req, res) => {
    try {
      const { firstName, lastName, email, password, roleId, status } = req.body;

      if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
        return res.invalid({ msg: 'Invalid/Missing firstName' });
      }
      if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
        return res.invalid({ msg: 'Invalid/Missing lastName' });
      }
      if (!email || !authService.isValidEmail(email)) {
        return res.invalid({ msg: 'Invalid/Missing email' });
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.invalid({ msg: 'Invalid/Missing password (min 8 characters)' });
      }
      if (!roleId || !isValidObjectId(roleId)) {
        return res.invalid({ msg: 'Invalid/Missing roleId' });
      }
      if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.invalid({ msg: 'Invalid status' });
      }

      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        roleId,
        status,
        createdBy: req.userId
      };

      const response = await usersService.create({ userData });
      if (!response.ok || !response.data) {
        if (response.duplicate) {
          return res.invalid({ msg: response.msg });
        }
        return res.failure({ msg: response.msg || 'Unable to create user!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  patch: async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, password, roleId, status } = req.body;

      if (!id || !isValidObjectId(id)) {
        return res.invalid({ msg: 'Invalid/Missing user id' });
      }

      const updateData = { updatedBy: req.userId };

      if (firstName !== undefined) {
        if (typeof firstName !== 'string' || firstName.trim().length === 0) {
          return res.invalid({ msg: 'Invalid firstName' });
        }
        updateData.firstName = firstName.trim();
      }
      if (lastName !== undefined) {
        if (typeof lastName !== 'string' || lastName.trim().length === 0) {
          return res.invalid({ msg: 'Invalid lastName' });
        }
        updateData.lastName = lastName.trim();
      }
      if (email !== undefined) {
        if (!authService.isValidEmail(email)) {
          return res.invalid({ msg: 'Invalid email' });
        }
        updateData.email = email.trim();
      }
      if (password !== undefined) {
        if (typeof password !== 'string' || password.length < 8) {
          return res.invalid({ msg: 'Invalid password (min 8 characters)' });
        }
        updateData.password = password;
      }
      if (roleId !== undefined) {
        if (!isValidObjectId(roleId)) {
          return res.invalid({ msg: 'Invalid roleId' });
        }
        updateData.roleId = roleId;
      }
      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          return res.invalid({ msg: 'Invalid status' });
        }
        updateData.status = status;
      }

      if (Object.keys(updateData).length === 1) {
        return res.invalid({ msg: 'No valid fields to update' });
      }

      const response = await usersService.patch({ userId: id, updateData });
      if (!response.ok || !response.data) {
        if (response.duplicate) {
          return res.invalid({ msg: response.msg });
        }
        return res.failure({ msg: response.msg || 'Unable to update user!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  }
};
