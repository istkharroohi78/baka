const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  chatId: { type: Number, required: true },
  count: { type: Number, default: 0 },
  reasons: [{ reason: String, date: Date }]
}, { timestamps: true });

module.exports = mongoose.model('Warning', warningSchema);
