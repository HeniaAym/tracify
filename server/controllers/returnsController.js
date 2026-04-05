const Return   = require('../models/Return');
const Parcel   = require('../models/Parcel');
const AuditLog = require('../models/AuditLog');

// =================================================
// استيراد ملف المرتجعات وتحديث الطرود
// =================================================
exports.uploadReturns = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });

    const xlsx   = require('xlsx');
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const raw      = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // إيجاد صف العناوين
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(raw.length, 5); i++) {
      if (raw[i] && raw[i].includes('ID')) { headerRowIndex = i; break; }
    }
    if (headerRowIndex === -1)
      return res.status(400).json({ error: 'لم يتم العثور على عناوين الأعمدة' });

    const headers  = raw[headerRowIndex];
    const dataRows = raw.slice(headerRowIndex + 1).filter(r => r && r[0]);

    const idx = {
      id:         headers.indexOf('ID'),
      sender:     headers.indexOf('Expéditeur'),
      client:     headers.indexOf('Client'),
      phone:      headers.indexOf('Tel 1'),
      commune:    headers.indexOf('Commune'),
      wilaya:     headers.indexOf('Wilaya'),
      total:      headers.indexOf('Total'),
      receivedAt: headers.indexOf('Date de réception'),
    };

    const rows = dataRows.map(r => ({
      tracking:  (r[idx.id]     || '').toString().trim(),
      customer:  (r[idx.client] || '').toString().trim(),
      phone:     (r[idx.phone]  || '').toString().trim(),
      price:     r[idx.total]   || 0,
      wilaya:    (r[idx.wilaya] || '').toString().trim(),
    })).filter(r => r.tracking);

    if (!rows.length)
      return res.status(400).json({ error: 'لم يتم العثور على أرقام تتبع في الملف' });

    let updatedToReturned = 0;
    let skippedPaid       = 0;
    let addedNew          = 0;
    const stationId = req.user.stationId;

    for (const row of rows) {
      const existing = await Parcel.findOne({ tracking: row.tracking, stationId });

      if (existing) {
        if (existing.status === 'pending') {
          await Parcel.updateOne(
            { tracking: row.tracking, stationId },
            { $set: { status: 'returned' } }
          );
          updatedToReturned++;
        } else if (existing.status === 'paid') {
          skippedPaid++;
        }
      } else {
        await Parcel.create({
          tracking:  row.tracking,
          customer:  row.customer || 'غير معروف',
          phone:     row.phone    || '—',
          price:     row.price    || 0,
          status:    'returned',
          stationId
        });
        addedNew++;
      }

      // إضافة لسجل المرتجعات
      await Return.create({
        tracking:  row.tracking,
        sender:    row.customer || 'غير معروف',
        client:    row.customer || '',
        phone:     row.phone,
        price:     row.price,
        wilaya:    row.wilaya,
        stationId
      });
    }

    await AuditLog.create({
      userId: req.user.userId,
      username: req.user.username,
      stationId,
      action: 'UPLOAD_RETURNS',
      target: 'Return',
      details: { count: rows.length }
    });

    res.json({
      success: true,
      total:           rows.length,
      updatedToReturned,
      skippedPaid,
      addedNew,
      message: `تم المعالجة: ${updatedToReturned} طرد تحوّل لمرتجع — ${addedNew} طرد جديد أُضيف — ${skippedPaid} تم تسليمه فعلاً`
    });

  } catch (err) {
    console.error('Error in uploadReturns:', err);
    res.status(500).json({ error: err.message });
  }
};

// =================================================
// لوحة الإحصائيات — كل شيء من Parcel
// =================================================
exports.getDashboard = async (req, res) => {
  try {
    const stationId = req.user.stationId;
    const allParcels = await Parcel.find({ stationId });

    const totalDelivered = allParcels.filter(p => p.status === 'paid').length;
    const totalPending   = allParcels.filter(p => p.status === 'pending').length;
    const totalReturned  = allParcels.filter(p => p.status === 'returned').length;
    const totalAll       = totalDelivered + totalReturned;

    const deliveryRate = totalAll > 0 ? ((totalDelivered / totalAll) * 100).toFixed(1) : 0;
    const returnRate   = totalAll > 0 ? ((totalReturned  / totalAll) * 100).toFixed(1) : 0;

    const returnValue = allParcels
      .filter(p => p.status === 'returned')
      .reduce((acc, p) => acc + (p.price || 0), 0);

    const recentReturns = await Parcel.find({ stationId, status: 'returned' })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      stats: {
        totalInSystem: allParcels.length,
        totalDelivered,
        totalPending,
        totalReturned,
        totalAll,
        deliveryRate,
        returnRate,
        returnValue,
      },
      recentReturns
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =================================================
// تقرير شهري
// =================================================
exports.getMonthlyReport = async (req, res) => {
  try {
    const stationId = req.user.stationId;
    const allParcels = await Parcel.find({ stationId });

    const returnsByMonth   = {};
    const deliveredByMonth = {};

    allParcels.filter(p => p.status === 'returned').forEach(p => {
      const d   = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      returnsByMonth[key] = (returnsByMonth[key] || 0) + 1;
    });

    allParcels.filter(p => p.status === 'paid').forEach(p => {
      const d   = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      deliveredByMonth[key] = (deliveredByMonth[key] || 0) + 1;
    });

    const allMonths = new Set([
      ...Object.keys(returnsByMonth),
      ...Object.keys(deliveredByMonth)
    ]);

    const months = Array.from(allMonths).sort().reverse().map(key => {
      const [year, month] = key.split('-');
      const returned  = returnsByMonth[key]  || 0;
      const delivered = deliveredByMonth[key] || 0;
      const total     = delivered + returned;
      return {
        key,
        label:        `${month}/${year}`,
        delivered,
        returned,
        total,
        deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0',
        returnRate:   total > 0 ? ((returned  / total) * 100).toFixed(1) : '0.0',
      };
    });

    res.json({ months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===================================================
// كل المرتجعات مع فلتر المحطة
// ===================================================
exports.getAllReturns = async (req, res) => {
  try {
    const { month } = req.query;
    const stationId = req.user.stationId;
    const filter = { stationId, status: 'returned' };

    if (month) {
      const [year, m] = month.split('-');
      const start = new Date(year, m - 1, 1);
      const end   = new Date(year, m,     1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const returns = await Parcel.find(filter).sort({ createdAt: -1 });
    res.json(returns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
