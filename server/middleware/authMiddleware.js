const jwt = require('jsonwebtoken');

// Verifies the Authorization: Bearer <token> header and attaches the
// decoded payload as req.user. Routes that use this can trust
// req.user.accountId/role instead of whatever the client puts in the
// URL or body — closing the gap where any caller could pass someone
// else's accountId and read/act on their rides.
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
    next();
  });
};
