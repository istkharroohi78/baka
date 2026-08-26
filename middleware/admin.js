const config = require('../config/index');

const isAdmin = async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
        ctx.isAdmin = false;
        ctx.isOwner = false;
        return next();
    }

    try {
        const member = await ctx.getChatMember(ctx.from.id);
        const isAdminStatus = ['administrator', 'creator'].includes(member.status);
        const isOwner = config.ownerId === ctx.from.id || config.sudoUsers.includes(ctx.from.id);

        ctx.isAdmin = isAdminStatus || isOwner;
        ctx.isOwner = isOwner;
    } catch (err) {
        ctx.isAdmin = false;
        ctx.isOwner = false;
    }

    return next();
};

module.exports = isAdmin;
