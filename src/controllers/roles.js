const { error } = require('utils/logger');
const rolesService = require('services/roles');

const VALID_STATUSES = ['active', 'inactive'];

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

      const response = await rolesService.getAll({
        limit: pageSize ? parseInt(pageSize, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined,
        status
      });
      if (!response.ok || !response.data) {
        return res.failure({ msg: 'Unable to fetch roles!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  }
};
