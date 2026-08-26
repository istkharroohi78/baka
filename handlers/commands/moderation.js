const { scanContent } = require('../services/aiModerationService');

async function aiModeration(ctx, next) {
    if (!ctx.message) return next();

    const text = ctx.message.text || ctx.message.caption || '';
    let isBad = false;

    // Text check
    if (text) isBad = await scanContent(text);

    // Photo/Sticker check (basic)
    if (ctx.message.photo || ctx.message.sticker) {
        isBad = await scanContent("Image content", null);
    }

    if (isBad) {
        await ctx.deleteMessage().catch(() => {});
        if (ctx.chat.type !== 'private') {
            await ctx.reply('🚫 Prohibited content deleted.');
        }
        return; // block further processing
    }

    return next();
}

module.exports = aiModeration;
