const mongoose = require('mongoose');

const cashMovementSchema = new mongoose.Schema({
  boxId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MoneyBox',
    required: true
  },
  type: {
    type: String,
    enum: ['PARCEL_PAYMENT', 'EXPENSE', 'ADJUSTMENT'],
    required: true
  },
  amount:       { type: Number, required: true },
  description:  { type: String, required: true },
  tracking:     { type: String },
  referenceId:  { type: mongoose.Schema.Types.ObjectId, refPath: 'referenceModel' },
  referenceModel: { type: String, enum: ['Parcel', null] },
  createdBy:    { type: String, default: 'reception' },
  stationId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  createdAt:    { type: Date, default: Date.now }
});

cashMovementSchema.index({ boxId: 1 });
cashMovementSchema.index({ stationId: 1 });
cashMovementSchema.index({ type: 1 });
cashMovementSchema.index({ createdAt: -1 });
cashMovementSchema.index({ tracking: 1 });

module.exports = mongoose.model('CashMovement', cashMovementSchema);
