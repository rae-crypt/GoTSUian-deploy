const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadFailedPhoto = require('../middleware/failedPhotoUpload');

// Multer rejects a wrong file type or a file over 5 MB with an error; answer
// it as a normal 400 the driver's form can show.
function failedPhotoUpload(req, res, next) {
  uploadFailedPhoto.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The photo must be 5 MB or smaller.' : err.message });
    next();
  });
}

router.post('/', authMiddleware, rideController.createRide);
router.post('/others-quote', authMiddleware, rideController.quoteOthersDropoff);
// Public: How It Works shows the current fare rates to visitors too.
router.get('/fare-settings', rideController.getFareSettings);
router.post('/reverse-geocode', authMiddleware, rideController.reverseGeocode);
router.post('/search-places', authMiddleware, rideController.searchPlaces);
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
router.get('/:rideId/route', authMiddleware, rideController.getRideRoute);
router.get('/:rideId/eta', authMiddleware, rideController.getRideEta);
router.put('/:rideId/pickup-location', authMiddleware, rideController.updateRidePickupLocation);
router.put('/:rideId/accept', authMiddleware, rideController.acceptRide);
router.put('/:rideId/decline', authMiddleware, rideController.declineRide);
router.put('/:rideId/convert-to-solo', authMiddleware, rideController.convertRideToSolo);
router.put('/:rideId/status', authMiddleware, rideController.updateRideStatus);
router.post('/:rideId/failed-photo', authMiddleware, failedPhotoUpload, rideController.uploadFailedRidePhoto);
router.get('/loyalty', authMiddleware, rideController.getLoyaltyStatus);
router.put('/loyalty/:certificateId/seen', authMiddleware, rideController.markCertificateSeen);
router.get('/driver-loyalty', authMiddleware, rideController.getDriverLoyaltyStatus);

module.exports = router;
