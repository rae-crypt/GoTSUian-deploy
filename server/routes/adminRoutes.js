const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

// Only a logged-in admin (role: "admin" from the JWT) can reach these —
// a student or driver token gets rejected here even if it's valid.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.get('/drivers', authMiddleware, requireAdmin, adminController.listDrivers);
router.put('/drivers/:driverId/status', authMiddleware, requireAdmin, adminController.updateDriverStatus);

module.exports = router;
