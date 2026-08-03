const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register/student', authController.registerStudent);
router.post('/login/student', authController.loginStudent);
router.post('/register/driver', authController.registerDriver);
router.post('/login/driver', authController.loginDriver);
router.post('/register/admin', authController.registerAdmin);
router.post('/login/admin', authController.loginAdmin);

module.exports = router;