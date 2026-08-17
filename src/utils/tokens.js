const config = require('config');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_COOKIE = config.get('cookies.accessToken');
const REFRESH_TOKEN_COOKIE = config.get('cookies.refreshToken');
const ACCESS_TOKEN_TTL = parseInt(config.get('accessTokenValidityInSeconds'), 10);
const REFRESH_TOKEN_TTL = parseInt(config.get('refreshTokenValidityInSeconds'), 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const cookieOptions = (maxAgeSeconds) => ({
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'lax',
  maxAge: maxAgeSeconds * 1000
});

const signAccessToken = ({ userId }) =>
  jwt.sign({ userId }, config.get('accessJwtSecret'), { expiresIn: ACCESS_TOKEN_TTL });

const signRefreshToken = ({ userId }) =>
  jwt.sign({ userId }, config.get('refreshJwtSecret'), { expiresIn: REFRESH_TOKEN_TTL });

const setAuthCookies = ({ res, userId }) => {
  const accessToken = signAccessToken({ userId });
  const refreshToken = signRefreshToken({ userId });

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_TTL));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(REFRESH_TOKEN_TTL));
};

const clearAuthCookies = ({ res }) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax' });
};

module.exports = {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  clearAuthCookies
};
