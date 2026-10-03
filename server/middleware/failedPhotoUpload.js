const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Optional photo a driver attaches when ending a ride as Failed (e.g. a flat
// tire). Same limits as the license upload (uploadMiddleware.js), but images
// only and its own folder, so license handling is untouched.
const failedRidesDir = path.join(__dirname, '..', 'uploads', 'failed-rides');
fs.mkdirSync(failedRidesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, failedRidesDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `ride_${req.params.rideId}_${Date.now()}${safeExt}`);
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/png'];

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only JPG or PNG photos are allowed'));
  }
  cb(null, true);
};

const uploadFailedPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = uploadFailedPhoto;
