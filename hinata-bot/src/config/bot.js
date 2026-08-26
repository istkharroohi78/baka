require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config/index');
const logger = require('./utils/logger');

// ====================== DATABASE ======================
require('./models/index');

// ====================== HANDLERS ======================
const startCommand = require('./handlers/commands/start');
const handleCallbacks = require('./handlers/callbacks');
const aiModeration = require('./handlers/moderation');
const chatbotHandler = require('./handlers/commands/chatbot');

const { balanceCommand } = require('./handlers/commands/economy');
const { wordGuess, gamew, guess, trivia } = require('./handlers/commands/games');

// ====================== BOT INSTANCE ======================
const bot = new Telegraf(config.botToken);

const { ban, sban, tban, unban, kick, mute, tmute, unmute, warn, purge, pin, rules, welcome } 
    = require('./handlers/commands/admin');

bot.command('ban', ban);
bot.command('sban', sban);
bot.command('tban', tban);
bot.command('unban', unban);
bot.command('kick', kick);
bot.command('mute', mute);
bot.command('tmute', tmute);
bot.command('unmute', unmute);
bot.command('warn', warn);
bot.command('purge', purge);
bot.command('pin', pin);
bot.command('rules', rules);
bot.command('welcome', welcome)

// ====================== MIDDLEWARES ======================
bot.use(aiModeration);                    // AI NSFW Protection

// ====================== COMMANDS ======================
bot.start(startCommand);
bot.command('ping', (ctx) => ctx.reply('🏓 Pong!'));
bot.command('balance', balanceCommand);
bot.command('wordguess', wordGuess);
bot.command('gamew', gamew);
bot.command('guess', guess);
bot.command('trivia', trivia);

// ====================== MESSAGE HANDLERS ======================
bot.on('message', chatbotHandler);       // AI Chatbot

// ====================== CALLBACKS ======================
bot.on('callback_query', handleCallbacks);

// ====================== LAUNCH BOT ======================
bot.launch()
  .then(() => logger.info('🚀 Hinata Bot is running successfully!'))
  .catch(err => logger.error('Bot Launch Error:', err));

// Graceful Shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
