const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const authMiddleware = require('../middleware/authMiddleware');

// Only a logged-in admin (role: "admin" from the JWT) can reach these —
// same pattern as adminRoutes.js's requireAdmin.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.post('/', authMiddleware, complaintController.createComplaint);
router.get('/mine', authMiddleware, complaintController.getMyComplaints);
router.get('/my-violations', authMiddleware, complaintController.getMyViolations);

router.get('/admin', authMiddleware, requireAdmin, complaintController.listComplaints);
router.put('/admin/:complaintId', authMiddleware, requireAdmin, complaintController.updateComplaintStatus);
router.post('/admin/violations', authMiddleware, requireAdmin, complaintController.issueViolation);

module.exports = router;
