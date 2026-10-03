const jwt = require('jsonwebtoken');
const { getSuspension, SUSPENDED_MESSAGE } = require('../suspension');

// Verifies the Authorization: Bearer <token> header and attaches the
// decoded payload as req.user. Routes that use this can trust
// req.user.accountId/role instead of whatever the client puts in the
// URL or body — closing the gap where any caller could pass someone
// else's accountId and read/act on their rides.
//
// A passenger/driver whose account has been suspended (see suspension.js)
// is refused with code ACCOUNT_SUSPENDED even though their token is still
// valid; the frontend logs them out when it sees that. If the check itself
// fails, the request goes through rather than locking everyone out.
module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    if (decoded.role === 'admin' || !decoded.accountId) return next();

    getSuspension(decoded.accountId, (suspErr, suspension) => {
      if (!suspErr && suspension) {
        return res.status(403).json({ error: SUSPENDED_MESSAGE, code: 'ACCOUNT_SUSPENDED' });
      }
      next();
    });
  });
};
