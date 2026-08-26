const { getHinataReply } = require('../../services/chatbotService');
const { logChatbot } = require('../../services/loggingService');
const logger = require('../../utils/logger');

const TRIGGER = /\bhinata\b/i;

async function chatbotHandler(ctx, next) {
  const text = ctx.message?.text || ctx.message?.caption;
  if (!text || text.startsWith('/')) return next ? next() : null;

  const isPM = ctx.chat?.type === 'private';
  const replyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo.id;
  const mentionsMe = TRIGGER.test(text)
    || (ctx.botInfo?.username && new RegExp(`@${ctx.botInfo.username}\\b`, 'i').test(text));

  if (!isPM && !replyToBot && !mentionsMe) return next ? next() : null;

  try {
    await ctx.sendChatAction('typing');
    const reply = await getHinataReply(ctx.from.id, ctx.chat.id, text);
    await ctx.reply(reply, { reply_to_message_id: ctx.message.message_id });
    logChatbot(ctx, reply).catch(() => {});
  } catch (e) {
    logger.warn(`chatbot error: ${e.message}`);
  }
  return next ? next() : null;
}

module.exports = chatbotHandler;
