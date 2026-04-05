const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true },
  isActive:     { type: Boolean, default: true },
  status:       { type: String, enum: ['active', 'suspended', 'expired'], default: 'active' },
  subscriptionEnd: { type: Date },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Station', stationSchema);
