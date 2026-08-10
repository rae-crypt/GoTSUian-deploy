const fs = require('fs');
const path = require('path');
const multer = require('multer');

const licensesDir = path.join(__dirname, '..', 'uploads', 'licenses');
fs.mkdirSync(licensesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, licensesDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `driver_${Date.now()}${safeExt}`);
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, or PDF files are allowed'));
  }
  cb(null, true);
};

const uploadLicense = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = uploadLicense;
