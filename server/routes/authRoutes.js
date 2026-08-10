const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const uploadLicense = require('../middleware/uploadMiddleware');

router.post('/register/student', authController.registerStudent);
router.post('/login/student', authController.loginStudent);
router.post('/register/driver', uploadLicense.single('licenseDocument'), authController.registerDriver);
router.post('/login/driver', authController.loginDriver);
router.post('/login/admin', authController.loginAdmin);

module.exports = router;