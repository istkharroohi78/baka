const logger = require('../utils/logger');

const loggingService = {
  logModeration: (chatId, userId, action, reason) => {
    logger.info(`[MOD] Chat:${chatId} User:${userId} Action:${action} Reason:${reason}`);
  }
};

module.exports = loggingService;
