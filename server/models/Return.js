const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  tracking:   { type: String, required: true, unique: true },
  sender:     { type: String },
  ref:        { type: String },
  client:     { type: String },
  phone:      { type: String },
  address:    { type: String },
  commune:    { type: String },
  wilaya:     { type: String },
  total:      { type: Number, default: 0 },
  note:       { type: String },
  products:   { type: String },
  ecoCreatedAt:  { type: Date },
  ecoReceivedAt: { type: Date },
  importedAt:    { type: Date, default: Date.now },
  stationId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
});

returnSchema.index({ wilaya: 1 });
returnSchema.index({ importedAt: -1 });
returnSchema.index({ ecoReceivedAt: -1 });

module.exports = mongoose.model('Return', returnSchema);
