const { ZodError } = require('zod');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    return res.status(400).json({ message: err.issues.map((i) => i.message).join(', ') });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'Galat ID' });
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'Server mein masla aa gaya' });
}

module.exports = { asyncHandler, HttpError, errorHandler };
