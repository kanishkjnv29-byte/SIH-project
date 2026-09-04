// Wraps an async route handler so a rejected promise (a failed DB call, a
// thrown error, etc.) is forwarded to next(err) instead of escaping as an
// unhandled rejection that could take down the process.
export function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
