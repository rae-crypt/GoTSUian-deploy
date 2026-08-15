const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const uploadLicense = require('../middleware/uploadMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register/student', authController.registerStudent);
router.post('/login/student', authController.loginStudent);
router.post('/register/driver', uploadLicense.single('licenseDocument'), authController.registerDriver);
router.post('/login/driver', authController.loginDriver);
router.post('/login/admin', authController.loginAdmin);
router.post('/reset-password/student', authController.resetPasswordStudent);
router.post('/change-password/student', authMiddleware, authController.changePasswordStudent);
router.post('/change-password/driver', authMiddleware, authController.changePasswordDriver);
router.post('/logout/student', authMiddleware, authController.logoutStudent);

module.exports = router;