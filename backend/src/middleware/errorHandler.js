function errorHandler(err, _req, res, _next) {
  console.error('[error]', err.message);
  const payload = { error: err.message || 'Server error' };
  if (err.code) payload.code = err.code;
  if (err.blockers) payload.blockers = err.blockers;
  res.status(err.status || 500).json(payload);
}

module.exports = { errorHandler };
