const fiveLetterWords = require('../../utils/dictionary');

// ====================== WORD GUESS GAME ======================
async function wordGuess(ctx) {
    await ctx.reply('🎮 **Word Guess Game**\n\nSend /wordguess to start a new game!');
}

// ====================== WORD STREAK GAME (/gamew) ======================
async function gamew(ctx) {
    const text = ctx.message.text.toLowerCase().trim();
    
    // Check if it's exactly 5 letters
    if (text.length !== 5) {
        return ctx.reply('❌ Please send a **5-letter word** only.');
    }

    if (fiveLetterWords.has(text)) {
        await ctx.reply('✅ **Valid word!** Good job!');
        // TODO: Later add streak counter + coin reward
    } else {
        await ctx.reply('❌ Not a valid English 5-letter word.');
    }
}

// ====================== OTHER GAMES (Stubs) ======================
async function guess(ctx) {
    await ctx.reply('🎥 **Anime/Movie Guess Game** coming soon...');
}

async function trivia(ctx) {
    await ctx.reply('❓ **Trivia Quiz** coming soon...');
}

module.exports = {
    wordGuess,
    gamew,
    guess,
    trivia
};
