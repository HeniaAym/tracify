const mongoose = require('mongoose');

const moneyBoxSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  boxCode:       { type: String, unique: true, sparse: true },
  isOpen:        { type: Boolean, default: false },
  openedAt:      { type: Date },
  stationId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  connectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  connectedByName: { type: String },
  createdAt:     { type: Date, default: Date.now }
});

moneyBoxSchema.index({ stationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('MoneyBox', moneyBoxSchema);
