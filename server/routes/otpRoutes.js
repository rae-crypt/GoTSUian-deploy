const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

router.post('/send', otpController.sendOtp);
router.post('/send-reset', otpController.sendResetOtp);
router.post('/verify', otpController.verifyOtp);

module.exports = router;
