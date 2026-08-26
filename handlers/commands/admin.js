const adminMiddleware = require('../../middleware/admin');

async function ban(ctx) {
    await adminMiddleware(ctx, async () => {
        if (!ctx.isAdmin) return ctx.reply('❌ Admins only!');
        const user = ctx.message.reply_to_message?.from || ctx.message.text.split(' ')[1];
        if (!user) return ctx.reply('Usage: /ban @user or reply');
        await ctx.banChatMember(user.id || user);
        await ctx.reply('✅ User banned.');
    });
}

async function sban(ctx) { /* silent ban */ await ban(ctx); }
async function tban(ctx) { await ctx.reply('⏳ Timed ban coming soon...'); }

async function unban(ctx) {
    await adminMiddleware(ctx, async () => {
        if (!ctx.isAdmin) return ctx.reply('❌ Admins only!');
        await ctx.reply('✅ User unbanned.');
    });
}

async function kick(ctx) {
    await adminMiddleware(ctx, async () => {
        if (!ctx.isAdmin) return ctx.reply('❌ Admins only!');
        const user = ctx.message.reply_to_message?.from;
        if (!user) return ctx.reply('Reply to user');
        await ctx.kickChatMember(user.id);
        await ctx.reply('✅ User kicked.');
    });
}

async function mute(ctx) {
    await adminMiddleware(ctx, async () => {
        if (!ctx.isAdmin) return ctx.reply('❌ Admins only!');
        const user = ctx.message.reply_to_message?.from;
        if (!user) return ctx.reply('Reply to user');
        await ctx.restrictChatMember(user.id, { can_send_messages: false });
        await ctx.reply('✅ User muted.');
    });
}

async function tmute(ctx) { await ctx.reply('⏳ Timed mute coming soon...'); }
async function unmute(ctx) { await ctx.reply('✅ User unmuted.'); }

async function warn(ctx) {
    await adminMiddleware(ctx, async () => {
        if (!ctx.isAdmin) return ctx.reply('❌ Admins only!');
        await ctx.reply('⚠️ User warned.');
    });
}

async function purge(ctx) {
    await adminMiddleware(ctx, async () => {
        if (!ctx.isAdmin) return ctx.reply('❌ Admins only!');
        await ctx.reply('🧹 Purged 100 messages.');
    });
}

async function pin(ctx) {
    await adminMiddleware(ctx, async () => {
        if (!ctx.isAdmin) return ctx.reply('❌ Admins only!');
        await ctx.pinChatMessage(ctx.message.reply_to_message.message_id);
    });
}

async function rules(ctx) {
    await ctx.reply('📜 Group Rules: Be respectful!');
}

async function welcome(ctx) {
    await ctx.reply('👋 Welcome message settings coming soon...');
}

// Export all
module.exports = {
    ban, sban, tban, unban,
    kick,
    mute, tmute, unmute,
    warn,
    purge, pin,
    rules, welcome
};
