const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');

router.post('/', rideController.createRide);
router.get('/pending', rideController.listPendingRides);
router.get('/mine/:accountId', rideController.getMyRides);
router.get('/driver/:accountId', rideController.getDriverRides);
router.put('/:rideId/accept', rideController.acceptRide);
router.put('/:rideId/status', rideController.updateRideStatus);

module.exports = router;
