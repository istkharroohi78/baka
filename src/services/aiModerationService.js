'use strict';

/**
 * NSFW Moderation — 3-layer pipeline
 *
 * TEXT:
 *   1. Rule engine (instant, zero network)
 *   2. Groq AI text scan (5-s timeout) for edge cases
 *   3. AI down → rule result is final
 *
 * IMAGE:
 *   1. Caption → full rule engine (instant)
 *   2. Groq AI vision scan (5-s timeout)
 *   3. AI down → local nsfwjs ML classifier (runs on-device, no API key)
 *   4. All fail → fail open
 *
 * The cooldown / caching lives in moderation.js.
 * Images are NEVER skipped here — only in moderation.js cache paths.
 */

const logger  = require('../utils/logger');
const limiter = require('../utils/groqLimiter');
const { checkText, checkImageCaption } = require('../utils/nsfwRules');
const { classifyImage } = require('../utils/localImageClassifier');

const TEXT_MODEL   = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
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

  // Layer 2: AI for edge cases
  const aiResult = await aiCheckText(text);
  if (aiResult === true)  return true;
  if (aiResult === false) return false;

  // Layer 3: AI unavailable — trust rules (already said SAFE)
  return false;
}

/**
 * Scan an image buffer. Returns true (NSFW) or false (safe). Never throws.
 *
 * Pipeline:
 *   1. Groq vision AI  (fast, highly accurate)
 *   2. local nsfwjs ML (on-device, no API, still accurate)
 *   3. fail open
 */
async function scanImage(imageBuffer, mime = 'image/jpeg') {
  if (!imageBuffer) return false;

  // Layer 1: Groq AI vision (primary)
  const aiResult = await aiCheckImage(imageBuffer, mime);
  if (aiResult === true)  return true;
  if (aiResult === false) return false;

  // Layer 2: Groq unavailable → local nsfwjs ML classifier
  logger.info('Image: Groq unavailable — falling back to local nsfwjs classifier');
  const localResult = await classifyImage(imageBuffer);
  if (localResult) return true;

  // Layer 3: both unavailable → fail open
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
  const aiResult = await aiCheckText(caption);
  return aiResult === true;
}

const scanContent = scanText;
module.exports = { scanText, scanImage, scanCaption, scanContent };
