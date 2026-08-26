const { getBalance } = require('../../services/economyService');

async function balanceCommand(ctx) {
    const balance = await getBalance(ctx.from.id);
    await ctx.reply(`💰 Your balance: **${balance} coins**`, { parse_mode: 'Markdown' });
}

module.exports = { balanceCommand };
