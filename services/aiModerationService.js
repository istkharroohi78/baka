const Groq = require('groq-sdk');
const config = require('../config/index');
const groq = new Groq({ apiKey: config.groqApiKey });

async function scanContent(text, imageBuffer = null) {
    try {
        let prompt = `Analyze if this content is NSFW, Gore, Scam, Drugs or Illegal. Reply only YES/NO + short reason.`;

        const response = await groq.chat.completions.create({
            model: "llama-3.2-11b-vision-preview",
            messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
        });

        const result = response.choices[0].message.content;
        return result.toLowerCase().includes('yes');
    } catch (e) {
        return false;
    }
}

module.exports = { scanContent };
