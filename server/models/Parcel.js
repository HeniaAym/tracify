const mongoose = require('mongoose');

const parcelSchema = new mongoose.Schema({
  tracking: { type: String, required: true, unique: true },
  phone:    { type: String, required: true },
  customer: { type: String, required: true },
  price:    { type: Number, required: true, min: 0 },
  status:   {
    type: String,
    enum: ['pending', 'paid', 'returned'],
    default: 'pending'
  },
  stationId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  lastEditedBy: { type: String },
  lastEditedAt: { type: Date },
  wasEdited:    { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

parcelSchema.index({ stationId: 1 });
parcelSchema.index({ status: 1 });
parcelSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Parcel', parcelSchema);
