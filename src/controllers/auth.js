const { error } = require('utils/logger');
const { parseCookie } = require('utils/commonFunctions');
const { REFRESH_TOKEN_COOKIE, setAuthCookies, clearAuthCookies } = require('utils/tokens');
const authService = require('services/auth');

const respondAuthServiceError = (res, response, fallbackMsg) => {
  if (response.code === authService.AUTH_FAILED) {
    return res.unauthorized({ msg: response.msg });
  }
  return res.failure({ msg: response.msg || fallbackMsg });
};

module.exports = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const response = await authService.login({ email, password });
      if (!response.ok || !response.data) {
        return respondAuthServiceError(res, response, 'Unable to login');
      }

      setAuthCookies({ res, userId: response.data.userId });
      return res.success({ data: response.data.user });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  refresh: async (req, res) => {
    try {
      const cookieString = req.headers.cookie;
      const cookies = cookieString ? parseCookie({ cookieString }) : {};
      const refreshToken = cookies[REFRESH_TOKEN_COOKIE];

      const response = await authService.refresh({ refreshToken });
      if (!response.ok || !response.data) {
        return respondAuthServiceError(res, response, 'Unable to refresh token');
      }

      setAuthCookies({ res, userId: response.data.userId });
      return res.success({ data: { userId: response.data.userId } });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  logout: async (req, res) => {
    try {
      clearAuthCookies({ res });
      return res.success({});
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  me: async (req, res) => {
    try {
      const response = await authService.getMe({ userId: req.userId });
      if (!response.ok || !response.data) {
        return res.failure({ msg: response.msg || 'Unable to fetch profile' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  }
};
