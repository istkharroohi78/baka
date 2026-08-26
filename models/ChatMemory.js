const mongoose = require('mongoose');

const chatMemorySchema = new mongoose.Schema({
  userId: Number,
  chatId: Number,
  messages: [{ role: String, content: String, timestamp: Date }],
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ChatMemory', chatMemorySchema);
