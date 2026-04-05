const xlsx     = require('xlsx');
const fs       = require('fs');
const Parcel   = require('../models/Parcel');
const AuditLog = require('../models/AuditLog');

// ===================================================
// خريطة الأعمدة — مجموعات من الأسماء المحتملة لكل حقل
// أضف أي اسم عمود جديد هنا عند التعامل مع شركة جديدة
// ===================================================
const COLUMN_MAP = {
  tracking: ['id', 'tracking', 'رقم التتبع', 'barcode', 'code', 'ref', 'réf', 'référence', 'n°', 'numero'],
  customer: ['client', 'customer', 'العميل', 'nom', 'name', 'destinataire', 'اسم العميل'],
  phone:    ['tel 1', 'tel1', 'phone', 'téléphone', 'telephone', 'الهاتف', 'هاتف', 'mobile', 'gsm', 'contact'],
  price:    ['total', 'prix', 'price', 'المبلغ', 'montant', 'cod', 'valeur', 'مبلغ'],
};

// إيجاد فهرس العمود بالاسم (غير حساس لحالة الأحرف والمسافات)
function findCol(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toString().trim().toLowerCase();
    if (aliases.some(a => h === a || h.includes(a))) return i;
  }
  return -1;
}

// ===================================================
// قراءة Excel فقط بدون حفظ — للتسوية
// ===================================================
exports.parseExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const workbook  = xlsx.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows      = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let headerRowIndex = -1;
    let headers        = [];

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (!rows[i] || rows[i].length < 3) continue;
      const row = rows[i].map(c => (c || '').toString().trim().toLowerCase());
      const hasTracking = COLUMN_MAP.tracking.some(a => row.some(h => h === a || h.includes(a)));
      const hasCustomer = COLUMN_MAP.customer.some(a => row.some(h => h === a || h.includes(a)));
      if (hasTracking || hasCustomer) {
        headerRowIndex = i;
        headers = rows[i];
        break;
      }
    }

    fs.unlinkSync(req.file.path);

    if (headerRowIndex === -1) {
      return res.status(400).json({ error: 'لم يتم التعرف على عناوين الأعمدة' });
    }

    const COL = {
      tracking: findCol(headers, COLUMN_MAP.tracking),
      customer: findCol(headers, COLUMN_MAP.customer),
      phone:    findCol(headers, COLUMN_MAP.phone),
      price:    findCol(headers, COLUMN_MAP.price),
    };

    const parcels = [];
    const dataRows = rows.slice(headerRowIndex + 1);

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      const tracking = row[COL.tracking]?.toString().trim();
      if (!tracking) continue;
      parcels.push({
        tracking,
        customer: COL.customer >= 0 ? (row[COL.customer]?.toString().trim() || '') : '',
        phone:    COL.phone    >= 0 ? (row[COL.phone]?.toString().trim()    || '') : '',
        price:    COL.price    >= 0 ? (parseFloat(row[COL.price]) || 0)            : 0,
      });
    }

    res.json({ success: true, parcels });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// استيراد Excel وحفظ الطرود في قاعدة البيانات
// ===================================================
exports.importExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const workbook  = xlsx.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows      = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // إيجاد صف العناوين (أول صف يحتوي على 'ID' أو 'tracking' أو 'Réf')
    let headerRowIndex = -1;
    let headers        = [];

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (!rows[i] || rows[i].length < 3) continue;
      const row = rows[i].map(c => (c || '').toString().trim().toLowerCase());
      // يُعتبر صف عناوين إذا وجد فيه عمود tracking أو customer
      const hasTracking = COLUMN_MAP.tracking.some(a => row.some(h => h === a || h.includes(a)));
      const hasCustomer = COLUMN_MAP.customer.some(a => row.some(h => h === a || h.includes(a)));
      if (hasTracking || hasCustomer) {
        headerRowIndex = i;
        headers = rows[i];
        break;
      }
    }

    if (headerRowIndex === -1) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'لم يتم التعرف على عناوين الأعمدة — تأكد أن الملف يحتوي على أعمدة: ID/Tracking, Client/العميل, Tel/الهاتف, Total/المبلغ'
      });
    }

    // تحديد فهرس كل عمود ديناميكياً
    const COL = {
      tracking: findCol(headers, COLUMN_MAP.tracking),
      customer: findCol(headers, COLUMN_MAP.customer),
      phone:    findCol(headers, COLUMN_MAP.phone),
      price:    findCol(headers, COLUMN_MAP.price),
    };

    // التحقق من وجود الأعمدة الأساسية
    const missing = Object.entries(COL).filter(([k, v]) => v === -1).map(([k]) => k);
    if (missing.length > 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: `أعمدة غير موجودة في الملف: ${missing.join(', ')}`,
        headers: headers.filter(Boolean)
      });
    }

    const dataRows = rows.slice(headerRowIndex + 1);
    const parcels  = [];
    const errors   = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      const tracking = row[COL.tracking]?.toString().trim();
      if (!tracking) continue;

      const customer = row[COL.customer]?.toString().trim();
      const phone    = row[COL.phone]?.toString().trim();
      const price    = parseFloat(row[COL.price]);

      if (!customer || !phone || isNaN(price)) {
        errors.push(`الصف ${headerRowIndex + i + 2}: بيانات ناقصة (${tracking})`);
        continue;
      }

      parcels.push({
        tracking, phone, customer, price, status: 'pending',
        stationId: req.user.stationId
      });
    }

    if (parcels.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'لم يتم العثور على بيانات صالحة', errors });
    }

    const inserted = [];
    for (const p of parcels) {
      try {
        const existing = await Parcel.findOne({ tracking: p.tracking, stationId: req.user.stationId });
        if (existing) { errors.push(`الطرد ${p.tracking} موجود مسبقاً`); continue; }
        await new Parcel(p).save();
        inserted.push(p);
      } catch (err) {
        errors.push(`خطأ في إدخال ${p.tracking}: ${err.message}`);
      }
    }

    fs.unlinkSync(req.file.path);

    await AuditLog.create({
      userId:    req.user.userId,
      username:  req.user.username,
      stationId: req.user.stationId,
      action:    'IMPORT_PARCELS',
      target:    'Parcel',
      details:   { count: inserted.length }
    });

    res.json({ success: true, totalRows: parcels.length, inserted: inserted.length, errors });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};