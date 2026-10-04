const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadEvidence = require('../middleware/evidenceUpload');

// Multer rejects a wrong file type or a file over 5 MB with an error; answer
// it as a normal 400 the report form can show.
function evidencePhotoUpload(req, res, next) {
  uploadEvidence.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The photo must be 5 MB or smaller.' : err.message });
    next();
  });
}

// Only a logged-in admin (role: "admin" from the JWT) can reach these —
// same pattern as adminRoutes.js's requireAdmin.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.post('/', authMiddleware, evidencePhotoUpload, complaintController.createComplaint);
router.post('/:complaintId/evidence', authMiddleware, evidencePhotoUpload, complaintController.uploadComplaintEvidence);
router.get('/mine', authMiddleware, complaintController.getMyComplaints);
router.get('/my-violations', authMiddleware, complaintController.getMyViolations);

router.get('/admin', authMiddleware, requireAdmin, complaintController.listComplaints);
router.get('/admin/:complaintId/evidence', authMiddleware, requireAdmin, complaintController.getComplaintEvidence);
router.get('/admin/rides/:rideId/messages', authMiddleware, requireAdmin, complaintController.getRideChatForAdmin);
router.put('/admin/:complaintId', authMiddleware, requireAdmin, complaintController.updateComplaintStatus);
router.post('/admin/violations', authMiddleware, requireAdmin, complaintController.issueViolation);

module.exports = router;
