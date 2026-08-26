const { Markup } = require('telegraf');

async function handleCallbacks(ctx) {
    const data = ctx.callbackQuery.data;

    if (data === 'help_main') {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🔰 Group Management', 'group_cmds')],
            [Markup.button.callback('🤖 AI ChatBot', 'chatbot_info')],
            [Markup.button.callback('🎮 Games', 'games_menu')],
            [Markup.button.callback('💰 Economy', 'economy_info')],
            [Markup.button.callback('🛡️ AI Moderation', 'mod_info')],
            [Markup.button.callback('🔥 NSFW Protection', 'nsfw_protect')]
        ]);

        await ctx.editMessageCaption('📜 **Hinata Bot Commands**', {
            parse_mode: 'Markdown',
            ...keyboard
        });
    }

    // ==================== GROUP MANAGEMENT MENU ====================
    else if (data === 'group_cmds') {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('👮 Core Admin', 'gm_core')],
            [Markup.button.callback('👋 Welcome/Goodbye', 'gm_welcome')],
            [Markup.button.callback('📜 Rules', 'gm_rules')],
            [Markup.button.callback('📝 Notes', 'gm_notes')],
            [Markup.button.callback('🔍 Filters', 'gm_filters')],
            [Markup.button.callback('🔒 Locks & Anti-Spam', 'gm_locks')],
            [Markup.button.callback('🛡️ Captcha', 'gm_captcha')],
            [Markup.button.callback('🚫 Blacklist', 'gm_blacklist')],
            [Markup.button.callback('ℹ️ User Info', 'gm_userinfo')],
            [Markup.button.callback('⚙️ Command Mgmt', 'gm_cmdmgmt')],
            [Markup.button.callback('🔗 Connections', 'gm_connections')],
            [Markup.button.callback('🔙 Back', 'help_main')]
        ]);

        await ctx.editMessageCaption('🔰 **Group Management** - Choose Category', {
            parse_mode: 'Markdown',
            ...keyboard
        });
    }

    // ==================== NSFW PROTECTION ====================
    else if (data === 'nsfw_protect') {
        await ctx.editMessageText(
            `🔥 <b>NSFW / AI Content Protection</b>\n\n` +
            `• Real-time scanning of Text, Photos, Stickers, GIFs, Videos, Captions\n` +
            `• Groq AI + OCR + Vision Detection\n` +
            `• Detects: NSFW, Gore, Drugs, Scam, Toxic, Illegal content\n` +
            `• Deletes content from <b>EVERYONE</b> including Admins\n` +
            `• Auto punishment (warn/mute/ban) for normal users\n` +
            `• Per-group settings (strict mode, scan types, etc.)`,
            { parse_mode: 'HTML' }
        );
    }

    // ==================== SUB CATEGORIES (Group Management) ====================
    else if (data === 'gm_core') {
        await ctx.editMessageText(
            `<b>👮 Core Admin Commands</b>\n\n` +
            `/ban /sban /tban /unban\n/kick /skick\n/mute /tmute /unmute\n/warn /rwarn /resetwarns /warns\n/purge /del\n/pin /unpin /permapin`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_welcome') {
        await ctx.editMessageText(
            `<b>👋 Welcome & Goodbye</b>\n\n` +
            `/setwelcome /resetwelcome /welcome\n/setgoodbye /resetgoodbye /goodbye\n/cleanwelcome on/off`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_rules') {
        await ctx.editMessageText(
            `<b>📜 Rules</b>\n\n` +
            `/setrules /rules /resetrules\n/privaterules on/off\n/setrulesbutton /resetrulesbutton`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_notes') {
        await ctx.editMessageText(
            `<b>📝 Notes</b>\n\n` +
            `/save /get /notes /clear`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_filters') {
        await ctx.editMessageText(
            `<b>🔍 Filters</b>\n\n` +
            `/filter /filters /stop`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_locks') {
        await ctx.editMessageText(
            `<b>🔒 Locks & Anti-Spam</b>\n\n` +
            `/lock /unlock /locks /locktypes\n/antiflood /setflood /flood`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_captcha') {
        await ctx.editMessageText(
            `<b>🛡️ Captcha</b>\n\n` +
            `/captcha on/off\n/captchamode\n/captchatime`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_blacklist') {
        await ctx.editMessageText(
            `<b>🚫 Blacklist</b>\n\n` +
            `/addblocklist /rmblocklist /blocklist`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_userinfo') {
        await ctx.editMessageText(
            `<b>ℹ️ User Info</b>\n\n` +
            `/id /info /adminlist /ping`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_cmdmgmt') {
        await ctx.editMessageText(
            `<b>⚙️ Command Management</b>\n\n` +
            `/disable /enable /disabled /disableable\n/disabledel on/off`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'gm_connections') {
        await ctx.editMessageText(
            `<b>🔗 Connections</b>\n\n` +
            `/connect /disconnect /connections`,
            { parse_mode: 'HTML' }
        );
    }

    // Other categories
    else if (data === 'chatbot_info') {
        await ctx.editMessageText('🤖 **AI ChatBot**\nMention / Reply / "Hinata"');
    }
    else if (data === 'games_menu') {
        await ctx.editMessageText('🎮 Games:\n/wordguess\n/gamew\n/guess\n/trivia');
    }
    else if (data === 'economy_info') {
        await ctx.editMessageText('💰 /balance\n/daily\n/weekly\n/leaderboard');
    }
    else if (data === 'mod_info') {
        await ctx.editMessageText('🛡️ Groq AI Moderation Active (NSFW/Gore/Spam)');
    }
}

module.exports = handleCallbacks;

module.exports = handleCallbacks;
