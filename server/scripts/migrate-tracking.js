// تشغيل: node server/scripts/migrate-receipts.js
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/ecomanager')
  .then(() => main())
  .then(() => { console.log('✅ انتهى'); mongoose.disconnect(); })
  .catch(err => { console.error(err); mongoose.disconnect(); });

async function generateCollNumber(used) {
  let num;
  do {
    num = `COLL-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (used.has(num));
  used.add(num);
  return num;
}

async function main() {
  const CashClosing      = require('../models/CashClosing');
  const DriverSettlement = require('../models/DriverSettlement').model ||
                           require('../models/DriverSettlement');

  const used = new Set();

  // جمع كل الأرقام الموجودة أولاً
  const allClosings    = await CashClosing.find({});
  const allSettlements = await DriverSettlement.find({}).catch(() => []);

  allClosings.forEach(c    => { if (c.receiptNumber)    used.add(c.receiptNumber); });
  allSettlements.forEach(s => { if (s.receiptNumber)    used.add(s.receiptNumber); });
  allSettlements.forEach(s => { if (s.settlementNumber) used.add(s.settlementNumber); });

  // تحويل CashClosing القديمة (REC-) إلى COLL-
  let count = 0;
  for (const c of allClosings) {
    if (c.receiptNumber && c.receiptNumber.startsWith('REC-')) {
      const oldNum = c.receiptNumber;
      const newNum = await generateCollNumber(used);
      await CashClosing.updateOne({ _id: c._id }, { $set: { receiptNumber: newNum } });
      console.log(`  ${oldNum} → ${newNum}`);
      count++;
    }
  }

  // تحويل DriverSettlement القديمة
  for (const s of allSettlements) {
    const old = s.receiptNumber || s.settlementNumber;
    if (old && !old.startsWith('COLL-')) {
      const newNum = await generateCollNumber(used);
      await DriverSettlement.updateOne(
        { _id: s._id },
        { $set: { receiptNumber: newNum, settlementNumber: newNum } }
      );
      console.log(`  ${old} → ${newNum}`);
      count++;
    }
  }

  console.log(`\n✅ تم تحويل ${count} سجل`);
}