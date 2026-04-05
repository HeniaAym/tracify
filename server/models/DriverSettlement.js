const mongoose = require('mongoose');

const driverSettlementSchema = new mongoose.Schema({
  settlementNumber: { type: String, unique: true },

  driverId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  driverName:  { type: String, required: true },
  vehicleType: { type: String },
  deliveryPrice: { type: Number, required: true },

  parcels: [{
    tracking:  { type: String },
    customer:  { type: String },
    price:     { type: Number },
    settled:   { type: Boolean, default: true }
  }],

  totalParcels:      { type: Number, default: 0 },
  totalAmount:       { type: Number, default: 0 },
  zeroPriceParcels:  { type: Number, default: 0 },
  companyDeduction:  { type: Number, default: 0 },   // zeroPriceParcels × deliveryPrice
  driverDeliveryFee: { type: Number, default: 0 },   // totalParcels × deliveryPrice
  amountDueToCompany:{ type: Number, default: 0 },   // totalAmount - driverDeliveryFee - companyDeduction

  settledBy:  { type: String, required: true },
  stationId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  settledAt:  { type: Date, default: Date.now },
  notes:      { type: String }
});

// توليد رقم التسوية تلقائياً — تسلسل موحد مع الصناديق
driverSettlementSchema.pre('save', async function () {
  if (!this.settlementNumber) {
    const { generateReceiptNumber } = require('../utils/receiptNumber');
    this.settlementNumber = await generateReceiptNumber();
  }
});

module.exports = mongoose.model('DriverSettlement', driverSettlementSchema);
