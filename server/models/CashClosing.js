const mongoose = require('mongoose');

const cashClosingSchema = new mongoose.Schema({
  // رقم التجميعة الفريد: REC-00001
  receiptNumber: { type: String, unique: true },

  boxId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MoneyBox',
    required: true
  },

  expectedAmount: { type: Number, required: true },
  actualAmount:   { type: Number, required: true },
  difference:     { type: Number, required: true },
  closedBy:       { type: String, required: true },
  closedAt:       { type: Date, default: Date.now },
  notes:          { type: String },
  stationId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  operatorName:   { type: String },       // المستخدم المتصل بالصندوق
  supervisorName: { type: String },       // المسؤول الذي ضغط تجميع

  parcels: [
    {
      parcelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parcel' },
      tracking: { type: String },
      customer: { type: String },
      phone:    { type: String },
      price:    { type: Number },
      paidAt:   { type: Date }
    }
  ]
});

// توليد رقم التجميعة تلقائياً — تسلسل موحد COLL-XXXXXX
cashClosingSchema.pre('save', async function () {
  if (!this.receiptNumber) {
    const { generateReceiptNumber } = require('../utils/receiptNumber');
    this.receiptNumber = await generateReceiptNumber();
  }
});

module.exports = mongoose.model('CashClosing', cashClosingSchema);