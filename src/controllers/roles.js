const { error } = require('utils/logger');
const rolesService = require('services/roles');
const { parseStrictPositiveInt } = require('utils/pagination');

const VALID_STATUSES = ['active', 'inactive'];
const MAX_PAGE_SIZE = 100;

module.exports = {
  getAll: async (req, res) => {
    try {
      const { pageSize, page, status } = req.query;

      let parsedPage;
      if (page !== undefined && page !== null) {
        parsedPage = parseStrictPositiveInt(page);
        if (!Number.isInteger(parsedPage) || parsedPage <= 0) {
          return res.invalid({ msg: 'Invalid page' });
        }
      }

      let parsedPageSize;
      if (pageSize !== undefined && pageSize !== null) {
        parsedPageSize = parseStrictPositiveInt(pageSize);
        if (
          !Number.isInteger(parsedPageSize) ||
          parsedPageSize <= 0 ||
          parsedPageSize > MAX_PAGE_SIZE
        ) {
          return res.invalid({ msg: 'Invalid pageSize' });
        }
      }

      if (status && !VALID_STATUSES.includes(status)) {
        return res.invalid({ msg: 'Invalid status' });
      }

      const response = await rolesService.getAll({
        limit: parsedPageSize,
        page: parsedPage,
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
