const Groq = require('groq-sdk');
const config = require('../config/index');
const ChatMemory = require('../models/ChatMemory');

const groq = new Groq({ apiKey: config.groqApiKey });

async function getHinataReply(userId, chatId, message) {
    let memory = await ChatMemory.findOne({ userId, chatId }) || new ChatMemory({ userId, chatId, messages: [] });
    
    memory.messages.push({ role: "user", content: message });
    if (memory.messages.length > 10) memory.messages.shift();

    const res = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: "You are Hinata, cute helpful anime girl." }, ...memory.messages]
    });

    const reply = res.choices[0].message.content;
    memory.messages.push({ role: "assistant", content: reply });
    await memory.save();

    return reply;
}

module.exports = { getHinataReply };
