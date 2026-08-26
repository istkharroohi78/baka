const { getHinataReply } = require('../../services/chatbotService');

async function chatbotHandler(ctx) {
    const text = ctx.message.text || ctx.message.caption;
    if (!text) return;

    const lower = text.toLowerCase();
    if (lower.includes('hinata') || ctx.message.reply_to_message) {
        const reply = await getHinataReply(ctx.from.id, ctx.chat.id, text);
        await ctx.reply(reply);
    }
}

module.exports = chatbotHandler;
