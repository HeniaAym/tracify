const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role:         { type: String, enum: ['admin', 'supervisor', 'user'], required: true },
  stationId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now }
});

userSchema.statics.hashPassword = async function (plain) {
  return bcrypt.hash(plain, 10);
};

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
