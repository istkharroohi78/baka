const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  title: String,
  settings: {
    welcomeEnabled: { type: Boolean, default: true },
    goodbyeEnabled: { type: Boolean, default: true },
    antiflood: { type: Boolean, default: true },
    nsfwProtection: { type: Boolean, default: true },
    strictMode: { type: Boolean, default: false }
  },
  rules: String,
  welcomeMessage: String
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
