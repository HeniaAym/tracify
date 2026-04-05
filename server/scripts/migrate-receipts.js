const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/ecomanager')
  .then(() => main())
  .then(() => {
    console.log('✅ Migration completed');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error(err);
    mongoose.disconnect();
  });

function generateCollNumber() {
  return `COLL-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function main() {
  const CashClosing = require('../models/CashClosing');
  const DriverSettlement = require('../models/DriverSettlement');

  let updated = 0;

  // 🔹 تحديث CashClosing فقط اللي تبدأ بـ REC-
  const closings = await CashClosing.find({
    receiptNumber: { $regex: '^REC-' }
  });

  for (const c of closings) {
    const newNum = generateCollNumber();

    await CashClosing.updateOne(
      { _id: c._id },
      { $set: { receiptNumber: newNum } }
    );

    console.log(`${c.receiptNumber} → ${newNum}`);
    updated++;
  }

  // 🔹 تحديث DriverSettlement
  const settlements = await DriverSettlement.find({
    $or: [
      { receiptNumber: { $regex: '^REC-' } },
      { settlementNumber: { $regex: '^REC-' } }
    ]
  });

  for (const s of settlements) {
    const newNum = generateCollNumber();

    await DriverSettlement.updateOne(
      { _id: s._id },
      {
        $set: {
          receiptNumber: newNum,
          settlementNumber: newNum
        }
      }
    );

    console.log(`${s.receiptNumber || s.settlementNumber} → ${newNum}`);
    updated++;
  }

  console.log(`\n🔥 تم تحديث ${updated} سجل`);
}