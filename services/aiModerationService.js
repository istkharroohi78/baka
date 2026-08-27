const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/index');

// Initialize API Clients
const groq = new Groq({ apiKey: config.groqApiKey });
const genAI = new GoogleGenerativeAI(config.geminiApiKey); // Make sure to add geminiApiKey in your config

async function scanContent(text, imageBuffer = null) {
    // Note: Added the actual 'text' variable to the prompt so the AI knows what to analyze
    let prompt = `Analyze if this content is NSFW, Gore, Scam, Drugs or Illegal. Content: "${text}". Reply only YES/NO + short reason.`;

    try {
        // 1. Primary Attempt: Groq API
        const response = await groq.chat.completions.create({
            model: "llama-3.2-11b-vision-preview",
            messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
        });

        const result = response.choices[0].message.content;
        return result.toLowerCase().includes('yes');

    } catch (groqError) {
        console.warn('Groq API failed. Falling back to Gemini...', groqError.message);

        try {
            // 2. Fallback Attempt: Gemini API
            // Using gemini-1.5-flash as it is extremely fast and cost-effective for moderation
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            return responseText.toLowerCase().includes('yes');

        } catch (geminiError) {
            // 3. If both fail, return false as safe default (or handle as you prefer)
            console.error('Both Groq and Gemini APIs failed:', geminiError.message);
            return false;
        }
    }
}

module.exports = { scanContent };
