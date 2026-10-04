const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Optional photo attached to a report ("Report a concern"). Same limits as
// the Failed-ride photo (failedPhotoUpload.js), its own folder, images only.
const complaintsDir = path.join(__dirname, '..', 'uploads', 'complaints');
fs.mkdirSync(complaintsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, complaintsDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `complaint_${req.params.complaintId}_${Date.now()}${safeExt}`);
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/png'];

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only JPG or PNG photos are allowed'));
  }
  cb(null, true);
};

const uploadEvidence = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = uploadEvidence;
