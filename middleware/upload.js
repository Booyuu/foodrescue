const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (_req, file, callback) => {
    const safeBase = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9_-]/gi, '-')
      .slice(0, 60);
    callback(null, `${Date.now()}-${safeBase}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    callback(allowed.includes(file.mimetype) ? null : new Error('Only JPG, PNG and WebP images are accepted.'), allowed.includes(file.mimetype));
  }
});

module.exports = upload;
