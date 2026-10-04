const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const uploadLicense = require('../middleware/uploadMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const { loginLimiter, signupLimiter } = require('../security');

router.post('/register/student', signupLimiter, authController.registerStudent);
router.post('/login/student', loginLimiter, authController.loginStudent);
router.post('/register/driver', signupLimiter, uploadLicense.single('licenseDocument'), authController.registerDriver);
router.post('/login/driver', loginLimiter, authController.loginDriver);
router.post('/reupload-license/driver', uploadLicense.single('licenseDocument'), authController.reuploadDriverLicense);
router.post('/login/admin', loginLimiter, authController.loginAdmin);
router.post('/reset-password/student', signupLimiter, authController.resetPasswordStudent);
router.post('/change-password/student', authMiddleware, authController.changePasswordStudent);
router.post('/change-password/driver', authMiddleware, authController.changePasswordDriver);
router.post('/logout/student', authMiddleware, authController.logoutStudent);

module.exports = router;