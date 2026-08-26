require('dotenv').config();

const OWNER_ID = 8441236350; // hardcoded owner — always has full power

module.exports = {
  botToken:      process.env.BOT_TOKEN,
  botUsername:   process.env.BOT_USERNAME || 'HinataBot',
  groqApiKey:    process.env.GROQ_API_KEY,
  groqApiKey2:   process.env.GROQ_API_KEY_2 || null,
  mongoUri:      process.env.MONGO_URI,
  ownerId:       OWNER_ID,
  sudoUsers:     process.env.SUDO_USERS
    ? process.env.SUDO_USERS.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean)
    : [],
  loggerGroupId: process.env.LOGGER_GROUP_ID ? parseInt(process.env.LOGGER_GROUP_ID, 10) : null,
  logLevel:      process.env.LOG_LEVEL || 'info',
  port:          process.env.PORT || 3000,
  pingImageUrl:  process.env.PING_IMAGE_URL || 'https://i.imgur.com/4M34hi2.png',
};
