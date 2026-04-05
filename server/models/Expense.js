const mongoose = require('mongoose');

const CATEGORIES = [
  'تصليح / صيانة',
  'رواتب موظفين',
  'غرامة',
  'إيجار مكتب',
  'فواتير كهرباء / ماء',
  'وقود سيارة',
  'نقل',
  'مستلزمات مكتب',
  'أخرى'
];

const expenseSchema = new mongoose.Schema({
  amount:      { type: Number, required: true, min: 0 },
  description: { type: String, required: true },
  category:    { type: String, enum: CATEGORIES, default: 'أخرى' },

  // مصدر الخصم: صندوق مباشر أو تجميعة
  sourceType:  { type: String, enum: ['box', 'closing'], required: true },
  boxId:       { type: mongoose.Schema.Types.ObjectId, ref: 'MoneyBox' },
  closingId:   { type: mongoose.Schema.Types.ObjectId, ref: 'CashClosing' },

  createdBy:   { type: String, default: 'reception' },
  stationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  createdAt:   { type: Date, default: Date.now }
});

expenseSchema.index({ createdAt: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ boxId: 1 });
expenseSchema.index({ closingId: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.CATEGORIES = CATEGORIES;