const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const { otpSendLimiter, otpVerifyLimiter } = require('../security');

router.post('/send', otpSendLimiter, otpController.sendOtp);
router.post('/send-reset', otpSendLimiter, otpController.sendResetOtp);
router.post('/verify', otpVerifyLimiter, otpController.verifyOtp);

module.exports = router;
