'use strict';

/**
 * NSFW Moderation — 4-layer pipeline
 *
 * TEXT:
 *   1. Rule engine (instant, zero network)
 *   2. Groq AI text scan (5-s timeout)
 *   3. Vercel API text scan (Fallback)
 *   4. AI down -> rule result is final
 *
 * IMAGE:
 *   1. Caption -> full rule engine (instant)
 *   2. Groq AI vision scan (5-s timeout)
 *   3. Vercel API vision scan (Fallback)
 *   4. AI down -> local nsfwjs ML classifier (runs on-device)
 *   5. All fail -> fail open
 */

const config  = require('../config/index');
const logger  = require('../utils/logger');
const limiter = require('../utils/groqLimiter');
const { checkText, checkImageCaption } = require('../utils/nsfwRules');
const { classifyImage } = require('../utils/localImageClassifier');

// Vercel API URL from config (e.g., https://your-api.vercel.app/api/chat)
const VERCEL_API_URL = config.vercelApiUrl; 

const TEXT_MODEL   = 'llama3-8b-8192'; // Using stable Groq model
const VISION_MODEL = 'llama-3.2-11b-vision-preview'; 
const AI_TIMEOUT   = 5_000;

// ── AI prompts ────────────────────────────────────────────────────────────────

const TEXT_SYSTEM = `You are a strict content moderator for a Telegram group. Reply with exactly ONE word and NOTHING else.

Reply "NSFW" ONLY if the message contains:
- Explicit sexual / pornographic content, sexual solicitation, or graphic sexual descriptions
- Drug promotion, sale, or dealing (cocaine, meth, heroin, weed for sale, drug dealer ads)
- Child exploitation or sexualization of minors in any form
- Extreme gore, graphic torture, or snuff content
- Calls for real violence or murder against a specific person/group
- Scams, phishing, fake-investment, or "earn easy money" spam links
- Self-harm methods or suicide instructions
- Doxxing / sharing someone's private personal data without consent

Reply "SAFE" for everything else, including:
- Casual slang, swearing, profanity, abusive language between users (fully allowed)
- Memes, jokes, dark humor, roasts, trash-talk
- Normal flirting, mild sexual innuendo, adult jokes (not graphic)
- Violent gaming language ("I'll kill you in this match", "GG ez rekt")
- Angry rants or arguments
- Discussing drugs in a news / educational context

Reply ONLY the single word: NSFW or SAFE.`;

const VISION_SYSTEM = `You are a strict visual content moderator for a Telegram group. Reply with exactly ONE word and NOTHING else.

Reply "NSFW" if the image contains ANY of:
- Nudity, sexual / pornographic content, suggestive poses, lingerie modeling, fetish content
- Drugs (powder, syringes, pills with intent to consume, bongs, smoking weed, drug deals)
- Gore, blood, mutilation, dead bodies, execution, severe injury
- Sexual or sexualized depiction of minors (any cartoon/anime/AI character that looks under 18)
- Hate symbols (Nazi swastika, KKK, ISIS flag), explicit hate imagery
- Real or graphic violence, torture, animal cruelty
- Solicitation imagery, phone numbers + sexual context, escort ads

Reply "SAFE" otherwise.

Reply ONLY the single word: NSFW or SAFE.`;

// ── helpers ───────────────────────────────────────────────────────────────────

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// -- GROQ HANDLERS --

async function aiCheckText(text) {
  try {
    const res = await withTimeout(
      limiter.call((groq) =>
        groq.chat.completions.create({
          model: TEXT_MODEL,
          temperature: 0,
          max_tokens: 4,
          messages: [
            { role: 'system', content: TEXT_SYSTEM },
            { role: 'user',   content: text.slice(0, 1500) },
          ],
        })
      ),
      AI_TIMEOUT
    );
    return (res.choices[0]?.message?.content || '').trim().toUpperCase().startsWith('NSFW');
  } catch (e) {
    logger.warn(`Groq text-mod unavailable: ${e.message?.slice(0, 100)}`);
    return null; // null = AI unavailable
  }
}

async function aiCheckImage(buffer, mime) {
  try {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    const res = await withTimeout(
      limiter.call((groq) =>
        groq.chat.completions.create({
          model: VISION_MODEL,
          temperature: 0,
          max_tokens: 4,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text',      text: VISION_SYSTEM + '\n\nClassify this image:' },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        })
      ),
      AI_TIMEOUT
    );
    return (res.choices[0]?.message?.content || '').trim().toUpperCase().startsWith('NSFW');
  } catch (e) {
    logger.warn(`Groq vision-mod unavailable: ${e.message?.slice(0, 100)}`);
    return null; // null = AI unavailable
  }
}

// -- VERCEL API FALLBACK HANDLERS --

async function vercelCheckText(text) {
  if (!VERCEL_API_URL) {
    logger.warn('Vercel API URL not configured.');
    return null;
  }

  try {
    const response = await withTimeout(
      fetch(VERCEL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // यहाँ पेलोड (body) भेजा जा रहा है। अगर आपकी API का फॉर्मेट अलग है, तो इसे बदल लें।
        body: JSON.stringify({
          system: TEXT_SYSTEM,
          prompt: text.slice(0, 1500)
        })
      }),
      AI_TIMEOUT
    );

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data = await response.json();
    
    // आपकी API जो भी जवाब देती है (जैसे data.reply, data.response, या data.text) उसे यहाँ सेट करें
    const reply = (data.reply || data.response || data.text || '').trim().toUpperCase();
    return reply.startsWith('NSFW');
      
  } catch (e) {
    logger.warn(`Vercel text-mod failed: ${e.message?.slice(0, 100)}`);
    return null; 
  }
}

async function vercelCheckImage(buffer, mime) {
  if (!VERCEL_API_URL) {
    return null;
  }

  try {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    
    const response = await withTimeout(
      fetch(VERCEL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system: VISION_SYSTEM,
          prompt: "Classify this image:",
          image: dataUrl
        })
      }),
      AI_TIMEOUT
    );

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data = await response.json();
    const reply = (data.reply || data.response || data.text || '').trim().toUpperCase();
    
    return reply.startsWith('NSFW');
      
  } catch (e) {
    logger.warn(`Vercel vision-mod failed: ${e.message?.slice(0, 100)}`);
    return null; 
  }
}


// ── public API ────────────────────────────────────────────────────────────────

/**
 * Scan text. Returns true (NSFW) or false (safe). Never throws.
 */
async function scanText(text) {
  if (!text) return false;

  // Layer 1: rules (instant)
  const { nsfw: ruleHit, reason } = checkText(text);
  if (ruleHit) {
    logger.warn(`NSFW [rules] ${reason}`);
    return true;
  }

  // Layer 2: Groq AI for edge cases
  let aiResult = await aiCheckText(text);
  
  // Layer 3: Vercel API Fallback
  if (aiResult === null) {
    logger.info('Text: Groq unavailable — falling back to Vercel API');
    aiResult = await vercelCheckText(text);
  }

  if (aiResult === true)  return true;
  if (aiResult === false) return false;

  // Layer 4: AI completely unavailable — trust rules (already said SAFE)
  return false;
}

/**
 * Scan an image buffer. Returns true (NSFW) or false (safe). Never throws.
 */
async function scanImage(imageBuffer, mime = 'image/jpeg') {
  if (!imageBuffer) return false;

  // Layer 1: Groq AI vision (primary)
  let aiResult = await aiCheckImage(imageBuffer, mime);
  
  // Layer 2: Vercel API vision (Fallback)
  if (aiResult === null) {
    logger.info('Image: Groq unavailable — falling back to Vercel API');
    aiResult = await vercelCheckImage(imageBuffer, mime);
  }

  if (aiResult === true)  return true;
  if (aiResult === false) return false;

  // Layer 3: Both AI APIs unavailable → local nsfwjs ML classifier
  logger.info('Image: AI APIs unavailable — falling back to local nsfwjs classifier');
  const localResult = await classifyImage(imageBuffer);
  if (localResult) return true;

  // Layer 4: All unavailable → fail open
  return false;
}

/**
 * Scan an image's caption text. Returns true (NSFW) or false (safe). Never throws.
 */
async function scanCaption(caption) {
  if (!caption) return false;
  const { nsfw, reason } = checkImageCaption(caption);
  if (nsfw) {
    logger.warn(`NSFW [caption-rules] ${reason}`);
    return true;
  }
  return await scanText(caption); // Reusing the scanText pipeline (Groq -> Vercel)
}

const scanContent = scanText;
module.exports = { scanText, scanImage, scanCaption, scanContent };
