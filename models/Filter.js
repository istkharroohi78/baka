const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  word: { type: String, required: true },
  action: { type: String, enum: ['delete', 'warn', 'mute'], default: 'delete' },
  createdBy: Number
}, { timestamps: true });

module.exports = mongoose.model('Filter', filterSchema);
