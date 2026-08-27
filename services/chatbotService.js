const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/index');
const ChatMemory = require('../models/ChatMemory');

const groq = new Groq({ apiKey: config.groqApiKey });

// मान लेते हैं कि आपने config में geminiApiKeys का एक Array (लिस्ट) बनाया है
// उदाहरण: const geminiKeys = [config.geminiKey1, config.geminiKey2, config.geminiKey3];
const geminiKeys = config.geminiApiKeys || []; 
const SYSTEM_PROMPT = "You are Sofiya, cute helpful anime girl.";

async function getHinataReply(userId, chatId, message) {
    let memory = await ChatMemory.findOne({ userId, chatId }) || new ChatMemory({ userId, chatId, messages: [] });
    
    // नया मैसेज मेमोरी में डालें
    memory.messages.push({ role: "user", content: message });
    if (memory.messages.length > 10) memory.messages.shift();

    let reply = "";
    let isSuccess = false;

    try {
        // 1. सबसे पहले Groq API ट्राई करें
        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...memory.messages]
        });

        reply = res.choices[0].message.content;
        isSuccess = true;

    } catch (groqError) {
        console.warn('Groq API failed, shifting to Gemini Keys...', groqError.message);

        // 2. Groq फेल होने पर Gemini की Keys को लूप में ट्राई करें
        for (let i = 0; i < geminiKeys.length; i++) {
            try {
                const genAI = new GoogleGenerativeAI(geminiKeys[i]);
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    systemInstruction: SYSTEM_PROMPT // Gemini 1.5 में system prompt यहाँ जाता है
                });

                // Gemini के लिए हिस्ट्री को सही फॉर्मेट में बदलें
                const geminiHistory = memory.messages.map(msg => ({
                    role: msg.role === "assistant" ? "model" : "user", // Gemini 'assistant' को 'model' बोलता है
                    parts: [{ text: msg.content }]
                }));

                const result = await model.generateContent({ contents: geminiHistory });
                reply = result.response.text();
                isSuccess = true;
                
                console.log(`Successfully used Gemini API Key #${i + 1}`);
                break; // जैसे ही रिप्लाई मिल जाए, लूप को रोक दें

            } catch (geminiError) {
                console.warn(`Gemini Key #${i + 1} failed:`, geminiError.message);
                // अगर यह key फेल हुई, तो लूप अगली key ट्राई करेगा
            }
        }
    }

    // अगर Groq और सभी 3 Gemini keys फेल हो जाएं
    if (!isSuccess) {
        reply = "I'm feeling a bit dizzy right now... my systems are overloaded. Please talk to me after some time! join - @Betabot_hub (T_T)";
    }

    // रिप्लाई को मेमोरी में सेव करें
    memory.messages.push({ role: "assistant", content: reply });
    await memory.save();

    return reply;
}

module.exports = { getHinataReply };
