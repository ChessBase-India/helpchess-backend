module.exports = (_req, res, next) => {
  res.serverError = ({ msg }) =>
    res.status(500).json({ ok: false, err: msg || 'Internal Server Error' });

  res.invalid = ({ msg }) =>
    res.status(200).json({ ok: false, err: msg || 'Invalid Parameters', data: null });

  res.failure = ({ msg }) =>
    res
      .status(200)
      .json({ ok: false, err: msg || "Something is wrong! We're looking into it.", data: null });

  res.unauthorized = ({ msg }) =>
    res.status(401).json({ ok: false, err: msg || 'Authentication Failed', data: null });

  res.forbidden = ({ msg }) =>
    res.status(403).json({ ok: false, err: msg || 'Forbidden', data: null });

  res.success = ({ data = {} }) => res.status(200).json({ ok: true, err: null, data });

  res.tooManyRequests = ({ msg }) =>
    res.status(429).json({ ok: false, err: msg || 'Too many requests', data: null });

  next();
};
