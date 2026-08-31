const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, rideController.createRide);
router.post('/others-quote', authMiddleware, rideController.quoteOthersDropoff);
router.get('/pending', authMiddleware, rideController.listPendingRides);
router.get('/mine', authMiddleware, rideController.getMyRides);
router.get('/driver', authMiddleware, rideController.getDriverRides);
router.get('/driver/availability', authMiddleware, rideController.getDriverAvailability);
router.put('/driver/availability', authMiddleware, rideController.updateDriverAvailability);
router.get('/available-drivers-count', authMiddleware, rideController.getAvailableDriversCount);
router.get('/available-drivers', authMiddleware, rideController.getAvailableDrivers);
router.put('/driver/location', authMiddleware, rideController.updateDriverLocation);
router.get('/:rideId/driver-location', authMiddleware, rideController.getDriverLocationForRide);
router.get('/:rideId/passenger-location', authMiddleware, rideController.getPassengerLocationForRide);
router.put('/:rideId/pickup-location', authMiddleware, rideController.updateRidePickupLocation);
router.put('/:rideId/accept', authMiddleware, rideController.acceptRide);
router.put('/:rideId/convert-to-solo', authMiddleware, rideController.convertRideToSolo);
router.put('/:rideId/status', authMiddleware, rideController.updateRideStatus);
router.get('/loyalty', authMiddleware, rideController.getLoyaltyStatus);
router.get('/driver-loyalty', authMiddleware, rideController.getDriverLoyaltyStatus);

module.exports = router;
