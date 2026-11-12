// Thrown from route handlers; the error middleware turns it into a JSON response
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v) => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v));

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

const clean = (v) => (v ?? '').toString().trim() || null;

const PROGRAMS = ['verification', 'cashback', 'both'];

module.exports = { HttpError, isDate, toInt, clean, PROGRAMS };
