'use strict';

/**
 * NSFW Moderation — 3-layer pipeline
 *
 * TEXT:
 *   1. Rule engine (instant, zero network)
 *   2. OpenRouter AI text scan (5-s timeout)
 *   3. AI down -> rule result is final
 *
 * IMAGE:
 *   1. Caption -> full rule engine (instant)
 *   2. OpenRouter AI vision scan (5-s timeout)
 *   3. AI down -> local nsfwjs ML classifier (runs on-device)
 *   4. All fail -> fail open
 */

const { OpenAI } = require('openai');
const config  = require('../config/index');
const logger  = require('../utils/logger');
const { checkText, checkImageCaption } = require('../utils/nsfwRules');
const { classifyImage } = require('../utils/localImageClassifier');

// Initialize OpenRouter using the OpenAI SDK
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.openRouterKey, // Make sure to add this in config/index.js
  defaultHeaders: {
    'HTTP-Referer': 'https://t.me/sofiya_bot', // Optional: OpenRouter likes to know where requests come from
    'X-Title': 'Sofiya Moderation Bot', 
  }
});

// Using gpt-4o-mini via OpenRouter (Fast and supports both Text & Vision)
// You can change this to 'google/gemini-1.5-flash' if you prefer
const MODEL = 'openai/gpt-4o-mini'; 
const AI_TIMEOUT = 5_000;

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

// -- OPENROUTER HANDLERS --

async function aiCheckText(text) {
  if (!config.openRouterKey) return null;

  try {
    const res = await withTimeout(
      openrouter.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 4,
        messages: [
          { role: 'system', content: TEXT_SYSTEM },
          { role: 'user',   content: text.slice(0, 1500) },
        ],
      }),
      AI_TIMEOUT
    );
    return (res.choices[0]?.message?.content || '').trim().toUpperCase().startsWith('NSFW');
  } catch (e) {
    logger.warn(`OpenRouter text-mod unavailable: ${e.message?.slice(0, 100)}`);
    return null; 
  }
}

async function aiCheckImage(buffer, mime) {
  if (!config.openRouterKey) return null;

  try {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    const res = await withTimeout(
      openrouter.chat.completions.create({
        model: MODEL,
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
      }),
      AI_TIMEOUT
    );
    return (res.choices[0]?.message?.content || '').trim().toUpperCase().startsWith('NSFW');
  } catch (e) {
    logger.warn(`OpenRouter vision-mod unavailable: ${e.message?.slice(0, 100)}`);
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

  // Layer 2: OpenRouter AI for edge cases
  const aiResult = await aiCheckText(text);
  
  if (aiResult === true)  return true;
  if (aiResult === false) return false;

  // Layer 3: AI completely unavailable — trust rules (already said SAFE)
  return false;
}

/**
 * Scan an image buffer. Returns true (NSFW) or false (safe). Never throws.
 */
async function scanImage(imageBuffer, mime = 'image/jpeg') {
  if (!imageBuffer) return false;

  // Layer 1: OpenRouter AI vision (primary)
  const aiResult = await aiCheckImage(imageBuffer, mime);
  
  if (aiResult === true)  return true;
  if (aiResult === false) return false;

  // Layer 2: AI unavailable → local nsfwjs ML classifier
  logger.info('Image: AI APIs unavailable — falling back to local nsfwjs classifier');
  const localResult = await classifyImage(imageBuffer);
  if (localResult) return true;

  // Layer 3: All unavailable → fail open
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
  return await scanText(caption); // Reusing the scanText pipeline 
}

const scanContent = scanText;
module.exports = { scanText, scanImage, scanCaption, scanContent };
