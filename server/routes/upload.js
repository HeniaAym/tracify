const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const ctrl     = require('../controllers/uploadController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// استيراد طرود وحفظها في DB
router.post('/', upload.single('file'), ctrl.importExcel);

// قراءة Excel فقط بدون حفظ (للتسوية)
router.post('/parse', upload.single('file'), ctrl.parseExcel);

module.exports = router;
