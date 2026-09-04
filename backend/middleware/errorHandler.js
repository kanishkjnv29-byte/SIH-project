// Express error-handling middleware (4 args — Express identifies it by arity).
// Must be registered after every route so it catches anything passed to next(err).
export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] Unhandled route error on ${req.method} ${req.originalUrl}:`, err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
}
