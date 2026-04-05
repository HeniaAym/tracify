const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

mongoose.connect('mongodb://127.0.0.1:27017/ecomanager')
  .then(() => console.log('MongoDB connected'))
  .then(() => main())
  .then(() => mongoose.disconnect())
  .catch(err => { console.error(err); mongoose.disconnect(); });

async function main() {
  const Station     = require('../models/Station');
  const User        = require('../models/User');
  const Parcel      = require('../models/Parcel');
  const CashMovement= require('../models/CashMovement');
  const CashClosing = require('../models/CashClosing');
  const Expense     = require('../models/Expense');
  const MoneyBox    = require('../models/MoneyBox');
  const Return      = require('../models/Return');

  // 1) إنشاء محطة "تمنراست" إن لم تكن موجودة
  let station = await Station.findOne({ name: 'تمنراست' });
  if (!station) {
    station = await Station.create({ name: 'تمنراست', status: 'active' });
    console.log('✅ تم إنشاء محطة تمنراست:', station._id);
  } else {
    console.log('ℹ️  محطة تمنراست موجودة مسبقاً:', station._id);
  }

  const stationId = station._id;

  // 2) تحديث جميع المستندات الموجودة بإضافة stationId
  const models = [
    { model: Parcel,      name: 'Parcels'      },
    { model: CashMovement,name: 'CashMovements' },
    { model: CashClosing, name: 'CashClosings'  },
    { model: Expense,     name: 'Expenses'      },
    { model: MoneyBox,    name: 'MoneyBoxes'    },
    { model: Return,      name: 'Returns'       }
  ];

  for (const { model, name } of models) {
    const count = await model.countDocuments({ stationId: { $exists: false } });
    if (count > 0) {
      const result = await model.updateMany(
        { stationId: { $exists: false } },
        { $set: { stationId } }
      );
      console.log(`✅ تم تحديث ${result.modifiedCount}/${count} مستند في ${name}`);
    } else {
      console.log(`ℹ️  لا توجد مستندات بدون stationId في ${name}`);
    }
  }

  // 3) إنشاء المستخدم الافتراضي (admin)
  let admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    admin = await User.create({
      username:     'admin',
      passwordHash,
      role:         'admin',
      stationId,
      isActive:     true
    });
    console.log('✅ تم إنشاء المستخدم admin (Admin@123)');
  } else {
    console.log('ℹ️  المستخدم admin موجود مسبقاً');
  }

  console.log('\n✅ الهجرة تمت بنجاح');
}
