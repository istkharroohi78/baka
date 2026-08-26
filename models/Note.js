const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  name: { type: String, required: true },
  content: { type: String, required: true },
  createdBy: Number
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
