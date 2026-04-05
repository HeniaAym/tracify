const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const ctrl     = require('../controllers/parcelController');
const { requireRole } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// الجميع يستطيع البحث
router.get('/search', ctrl.searchParcels);

// دفع طرد (يستخدمه صفحة البحث)
router.post('/:id/pay', ctrl.payParcel);

// تسليم جماعي من Excel — قبل Routes المعرفة بـ /:id
router.post('/bulk-deliver',
  requireRole('supervisor', 'admin'),
  upload.single('file'),
  ctrl.bulkDeliver
);

// تعديل بيانات الطرد (للمشرف والمسؤول)
router.put('/:id', requireRole('supervisor', 'admin'), ctrl.updateParcel);

// الحصول على جميع الطرود (للمشرف والمسؤول)
router.get('/',    requireRole('supervisor', 'admin'), ctrl.getAllParcels);

// استيراد من Excel (مع تسجيل المكررات)
router.post('/import',
  requireRole('supervisor', 'admin'),
  upload.single('file'),
  ctrl.importExcel
);

module.exports = router;
