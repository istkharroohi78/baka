const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true, index: true },
  username: String,
  firstName: String,
  lastName: String,
  language: { type: String, default: 'en' },
  isBanned: { type: Boolean, default: false },
  globalBanReason: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
