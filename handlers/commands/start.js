const { Markup } = require('telegraf');
const os = require('os');
const config = require('../../config/index');

async function startCommand(ctx) {
    const username = ctx.from.first_name || "User";
    const botName = "Hinata";

    // Fake stats for now (you can make real later)
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = Math.floor(uptime % 60);

    const startMsg = `┌────── ˹ ɪɴғᴏʀᴍᴀᴛɪᴏɴ ˼─── ⏤‌‌ 🔹
                      ┆🌺 ʜєʏ, ${username}🤩
                      ┆🌺 ɪ ᴀᴍ ${botName} ✨
                      └──────────────────────•
                      ᴀɴ ᴀʟʟ-ɪɴ-ᴏɴᴇ ɢʀᴏᴜᴘ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ + ᴀɪ ᴘʀᴏᴛᴇᴄᴛɪᴏɴ ʙᴏᴛ , ʀᴏsᴇ ʟᴇᴠᴇʟ ᴍᴏᴅᴇʀᴀᴛɪᴏɴ
                      ➥ ᴜᴘᴛɪᴍᴇ: ${hours}h:${mins}m:${secs}s
                      ➥ sᴇʀᴠᴇʀ sᴛᴏʀᴀɢᴇ: 27.4%
                      ➥ ᴄᴘᴜ ʟᴏᴀᴅ: 11.2%
                      ➥ ʀᴀᴍ ᴄᴏɴsᴜᴍᴘᴛɪᴏɴ: 17.5%
                      •──────────────────────•
                      🌺 ᴘᴏᴡєʀєᴅ ʙʏ » |𝐌 ᴀ ᴅ ᴀ ʀ ᴀ •| (t.me/YOUR_MADARA_BRO)
                      •──────────────────────•`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('👨‍💻 DEVELOPER', 'tg://user?id=' + config.ownerId)],
        [Markup.button.url('🌐 NETWORK', 'https://t.me/yourchannel')],
        [Markup.button.url('🏠 MY HOME', 'https://t.me/yourgroup')],
        [Markup.button.callback('📜 MY COMMANDS', 'help_main')]
    ]);

    await ctx.replyWithPhoto('https://i.ibb.co/PsVzsK8x/image.jpg', {
        caption: startMsg,
        parse_mode: 'HTML',
        ...keyboard
    });
}

module.exports = startCommand;
