const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/:rideId', authMiddleware, messageController.getMessages);
router.post('/', authMiddleware, messageController.sendMessage);

module.exports = router;
