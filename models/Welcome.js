const Welcome = require('../models/Welcome');

async function welcomeHandler(ctx) {
    if (ctx.chat.type === 'private') return;

    const settings = await Welcome.findOne({ chatId: ctx.chat.id }) || new Welcome({ chatId: ctx.chat.id });
    
    if (!settings.welcomeEnabled) return;

    const user = ctx.from;
    const welcomeMsg = `┌────── ˹ ɴᴇᴡ ᴍᴇᴍʙᴇʀ ˼────── ⏤
                        ┆🌸 ᴡᴇʟᴄᴏᴍᴇ, <a href="tg://user?id=${user.id}">${user.first_name}</a> 🤩
                        ┆🌺 ᴛᴏ <b>${ctx.chat.title}</b>
                        └──────────────────────•

                        🌸 ʜᴏᴘᴇ ʏᴏᴜ ᴇɴᴊᴏʏ ʏᴏᴜʀ sᴛᴀʏ ʜᴇʀᴇ!`;

    await ctx.replyWithPhoto('https://i.ibb.co/bjdNCnH2/image.jpg', {
        caption: welcomeMsg,
        parse_mode: 'HTML'
    });
}

async function goodbyeHandler(ctx) {
    if (ctx.chat.type === 'private' || !ctx.leftChatMember) return;

    const settings = await Welcome.findOne({ chatId: ctx.chat.id }) || new Welcome({ chatId: ctx.chat.id });
    
    if (!settings.goodbyeEnabled) return;

    const user = ctx.leftChatMember;
    const goodbyeMsg = `┌────── ˹ ɢᴏᴏᴅʙʏᴇ ˼────── ⏤
                        ┆👋 ${user.first_name} ʟᴇғᴛ ᴛʜᴇ ɢʀᴏᴜᴘ
                        ┆🌺 ᴡᴇ ᴡɪʟʟ ᴍɪss ʏᴏᴜ!
                        └──────────────────────•`;

    await ctx.replyWithPhoto('https://i.ibb.co/G4ZTZcYH/image.jpg', {
        caption: goodbyeMsg,
        parse_mode: 'HTML'
    });
}

module.exports = { welcomeHandler, goodbyeHandler };
