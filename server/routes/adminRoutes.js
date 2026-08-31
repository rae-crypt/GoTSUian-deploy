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

router.get('/stats', authMiddleware, requireAdmin, adminController.getStats);
router.get('/drivers', authMiddleware, requireAdmin, adminController.listDrivers);
router.get('/passengers', authMiddleware, requireAdmin, adminController.listPassengers);
router.get('/bookings', authMiddleware, requireAdmin, adminController.listBookings);
router.put('/drivers/:driverId/status', authMiddleware, requireAdmin, adminController.updateDriverStatus);
router.put('/drivers/:driverId/reset-password', authMiddleware, requireAdmin, adminController.resetDriverPassword);
router.get('/drivers/:driverId/license', authMiddleware, requireAdmin, adminController.getDriverLicenseFile);
router.get('/loyalty/overview', authMiddleware, requireAdmin, adminController.listLoyaltyOverview);
router.get('/loyalty/history', authMiddleware, requireAdmin, adminController.listLoyaltyHistory);
router.post('/loyalty/grant', authMiddleware, requireAdmin, adminController.grantLoyaltyCertificate);

module.exports = router;
