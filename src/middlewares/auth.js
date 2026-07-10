require('dotenv-safe').config();
const config = require('config');
const jwt = require('jsonwebtoken');

const { error } = require('utils/logger');
const { parseCookie } = require('utils/commonFunctions');
const usersModel = require('models/users');

const REFRESH_TOKEN_COOKIE = config.get('cookies.refreshToken');
const INTERNAL_JWT_COOKIE = config.get('cookies.internalJwt');

// factories for better code reusability

const verifyCookieAuth =
  (isOptional = false) =>
  async (req, res, next) => {
    try {
      const cookieString = req.headers.cookie;

      if (!cookieString) {
        return isOptional ? next() : res.unauthorized({});
      }

      const { [REFRESH_TOKEN_COOKIE]: refreshToken } = parseCookie({ cookieString });

      if (!refreshToken) {
        return isOptional ? next() : res.unauthorized({});
      }

      try {
        const data = jwt.verify(refreshToken, config.get('refreshJwtSecret'));

        req.userId = data.userId;
        req.refreshToken = refreshToken;
        return next();
      } catch (jwtError) {
        if (isOptional) {
          return next();
        }
        return res.unauthorized({});
      }
    } catch (e) {
      if (isOptional) {
        return next();
      }

      return res.unauthorized({});
    }
  };

// authentication middlewares
module.exports = {
  /**
   * Basic service-to-service auth using a static access token
   * passed in the Authorization header.
   */
  authenticate: async (req, res, next) => {
    if (req.header('Authorization') === config.get('accessToken')) {
      next();
      return;
    }
    res.unauthorized({});
  },

  /**
   * User auth via a refresh-token JWT cookie. Sets req.userId.
   */
  authenticateByCookie: verifyCookieAuth(false),

  /**
   * Same as authenticateByCookie, but lets the request through
   * without req.userId when no valid cookie is present.
   */
  authenticateByCookieOptional: verifyCookieAuth(true),

  /**
   * Auth for internal (back-office) users via a separate JWT cookie.
   * Sets req.userId, meant to be paired with authorizeInternalAccess.
   */
  authenticateByCookieInternal: async (req, res, next) => {
    try {
      const cookieString = req.headers.cookie;

      if (!cookieString) {
        return res.unauthorized({});
      }

      const { [INTERNAL_JWT_COOKIE]: internalJwt } = parseCookie({ cookieString });

      if (!internalJwt) {
        return res.unauthorized({});
      }

      const data = jwt.verify(internalJwt, config.get('refreshJwtSecret'));
      req.userId = data.userId;
      return next();
    } catch (e) {
      error(e);
      return res.unauthorized({});
    }
  },

  /**
   * Middleware to authorize internal API access based on roles/permissions.
   * Users with 'admin' role bypass all permission checks.
   * @param {string|string[]} requiredPermissions - Permission or array of permissions required to access the route.
   * @returns {function} Express middleware
   */
  authorizeInternalAccess: (requiredPermissions) => async (req, res, next) => {
    try {
      const { userId } = req;

      if (!userId) {
        return res.unauthorized({ msg: 'User not authenticated' });
      }

      // Single optimized database call to get user with permissions
      const user = await usersModel.getUserWithPermissions({ userId });

      if (!user) {
        return res.unauthorized({ msg: 'User not found' });
      }

      const userPermissions = user.permissions || [];

      // Users with admin role bypass all permission checks
      if (user.admin) {
        req.userPermissions = userPermissions;
        req.isAdmin = true;
        return next();
      }

      // Check specific permissions for non-admin users
      const hasPermissions = Array.isArray(requiredPermissions)
        ? requiredPermissions.some((permission) => userPermissions.includes(permission))
        : userPermissions.includes(requiredPermissions);

      if (!hasPermissions) {
        return res.forbidden({ msg: 'Insufficient permissions' });
      }

      req.userPermissions = userPermissions;
      req.isAdmin = false;
      return next();
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Failed to check permissions' });
    }
  }
};
