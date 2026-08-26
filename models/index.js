const mongoose = require('mongoose');
const config = require('../config/index');
const logger = require('../utils/logger');

mongoose.connect(config.mongoUri)
  .then(() => logger.info('✅ MongoDB Connected'))
  .catch(err => logger.error('MongoDB Connection Error', err));

module.exports = {
  User: require('./User'),
  Group: require('./Group'),
  Wallet: require('./Wallet'),
  ChatMemory: require('./ChatMemory')
};
