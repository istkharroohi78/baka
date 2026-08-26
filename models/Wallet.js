const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  coins: { type: Number, default: 0 },
  lastDaily: Date,
  lastWeekly: Date
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
