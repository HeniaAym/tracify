const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  vehicleType:  { type: String }, // سيارة/دراجة/شاحنة
  deliveryPrice:{ type: Number, default: 0 },
  workArea:     { type: String },
  stationId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Driver', driverSchema);
