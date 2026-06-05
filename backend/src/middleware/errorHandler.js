function errorHandler(err, _req, res, _next) {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Lỗi server' });
}

module.exports = { errorHandler };
