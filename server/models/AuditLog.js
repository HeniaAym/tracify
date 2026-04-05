const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:   { type: String },
  stationId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
  action:     { type: String, required: true },
  target:     { type: String },
  targetId:   { type: mongoose.Schema.Types.ObjectId },
  details:    { type: Object },
  ip:         { type: String },
  createdAt:  { type: Date, default: Date.now }
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ stationId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
