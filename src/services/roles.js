const { error } = require('utils/logger');
const rolesModel = require('models/roles');

module.exports = {
  getAll: async ({ page = 1, limit = 50, status } = {}) => {
    try {
      const result = await rolesModel.getAll({ page, limit, status });
      if (!result) {
        return { ok: false, msg: 'Unable to fetch roles.' };
      }
      return { ok: true, data: result };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  }
};
