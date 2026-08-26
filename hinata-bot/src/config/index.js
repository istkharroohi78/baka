require('dotenv').config();

module.exports = {
  botToken: process.env.BOT_TOKEN,
  botUsername: process.env.BOT_USERNAME || 'HinataBot',
  groqApiKey: process.env.GROQ_API_KEY,
  mongoUri: process.env.MONGO_URI,
  ownerId: parseInt(process.env.OWNER_ID),
  sudoUsers: process.env.SUDO_USERS ? process.env.SUDO_USERS.split(',').map(id => parseInt(id)) : [],
  logLevel: process.env.LOG_LEVEL || 'info',
  port: process.env.PORT || 3000,
};
