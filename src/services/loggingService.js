/**
 * Hinata Bot — Global Activity Logger
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends all bot activity to the configured logger group using Telegram's
 * <blockquote> HTML tag for a clean, sequential, fancy look.
 *
 * Every event message has:
 *   • Icon + bold title header (outside quote — always visible)
 *   • <blockquote> block with details — chat, actor, target, reason, time
 */

const { getLoggerGroupId } = require('../utils/botSettings');
const logger = require('../utils/logger');

let _bot = null;
function init(bot) { _bot = bot; }

// ─── icon map ─────────────────────────────────────────────────────────────────

const ICONS = {
  ban:          '🔨', unban:        '♻️',  kick:         '👢',
  mute:         '🔇', unmute:       '🔊',  warn:         '⚠️',
  warn_limit:   '🚨', warn_remove:  '🗑️',  warn_reset:   '🔄',
  nsfw:         '🔞', flood:        '🌊',  blacklist:    '🚫',
  link_removed: '🔗', join:         '👋',  leave:        '🚶',
  promote:      '⭐️', demote:       '📉',  note:         '📝',
  filter:       '🔍', pin:          '📌',  unpin:        '📍',
  lock:         '🔒', unlock:       '🔓',  captcha_fail: '🛡️',
  captcha_pass: '✅', raid:         '🛑',  fed_ban:      '🌐',
  bot_ban:      '⛔️', kill:         '🗡️',  rob:          '💰',
  protect:      '🛡️', broadcast:    '📣',  sudo_add:     '🔑',
  sudo_remove:  '🔑', coins_give:   '💵',  coins_take:   '💸',
  setlog:       '📡', connection:   '🔌',  topic:        '🗂️',
  purge:        '🧹', delete_msg:   '🗑️',  clean:        '🧼',
  chatbot:      '🤖', daily:        '🎁',  weekly:       '📅',
  leaderboard:  '🏆', approval:     '✅',  unapproval:   '❌',
  rules:        '📜', start:        '🌸',  help:         '❓',
  info:         'ℹ️', error:        '❌',  stats:        '📊',
};

function icon(type) { return ICONS[type] || 'ℹ️'; }

// ─── helpers ──────────────────────────────────────────────────────────────────

function esc(t) {
  return String(t || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function userLink(u) {
  if (!u) return '—';
  const name = esc(u.first_name || u.id);
  return `<a href="tg://user?id=${u.id}">${name}</a> (<code>${u.id}</code>)`;
}

function chatName(c) {
  if (!c) return '—';
  return `<b>${esc(c.title || c.id)}</b> (<code>${c.id}</code>)`;
}

function now() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  }) + ' IST';
}

// ─── core send ────────────────────────────────────────────────────────────────

async function _send(html) {
  const groupId = await getLoggerGroupId();
  if (!groupId || !_bot) return;
  try {
    await _bot.telegram.sendMessage(groupId, html, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (e) {
    logger.warn(`Logger send error: ${e.message}`);
  }
}

// ─── build a fancy blockquote log message ─────────────────────────────────────
//
//  Header (outside quote, always visible):
//    🔨 <b>BAN</b>  •  GroupName
//
//  <blockquote>
//    👤 By:  …
//    🎯 On:  …
//    📝 Reason: …
//    ⏳ Duration: …
//    💰 Amount: …
//    📎 Extra: …
//    🕐 12:30:45 IST
//  </blockquote>

async function logEvent(type, data = {}) {
  const ic   = icon(type);
  const title = type.toUpperCase().replace(/_/g, ' ');

  const headerChat = data.chat ? `  •  ${esc(data.chat.title || data.chat.id)}` : '';
  const header = `${ic} <b>${title}</b>${headerChat}`;

  const rows = [];
  if (data.chat)     rows.push(`📍 <b>Chat:</b> ${chatName(data.chat)}`);
  if (data.actor)    rows.push(`👤 <b>By:</b> ${userLink(data.actor)}`);
  if (data.target)   rows.push(`🎯 <b>On:</b> ${userLink(data.target)}`);
  if (data.reason)   rows.push(`📝 <b>Reason:</b> ${esc(data.reason)}`);
  if (data.duration) rows.push(`⏳ <b>Duration:</b> <code>${esc(data.duration)}</code>`);
  if (data.amount != null) rows.push(`💰 <b>Amount:</b> <b>${esc(String(data.amount))}</b>`);
  if (data.extra)    rows.push(`📎 ${esc(String(data.extra))}`);
  rows.push(`🕐 <i>${now()}</i>`);

  const html = `${header}\n<blockquote>${rows.join('\n')}</blockquote>`;
  await _send(html);
}

// ─── specialised log helpers (used directly by handlers) ──────────────────────

async function logCommand(type, ctx, extra = {}) {
  await logEvent(type, {
    chat:   ctx.chat,
    actor:  ctx.from,
    target: extra.target,
    reason: extra.reason,
    duration: extra.duration,
    amount: extra.amount,
    extra:  extra.note,
  });
}

async function logNsfw(ctx, reason) {
  await logEvent('nsfw', {
    chat:   ctx.chat,
    target: ctx.from,
    reason: `Prohibited ${reason} content removed`,
  });
}

async function logLinkRemoved(ctx) {
  await logEvent('link_removed', {
    chat:   ctx.chat,
    target: ctx.from,
    reason: 'Sent a link — link protection is ON',
  });
}

async function logChatbot(ctx, reply) {
  await logEvent('chatbot', {
    chat:  ctx.chat,
    actor: ctx.from,
    extra: `Msg: "${String(ctx.message?.text || '').slice(0, 60)}…" → "${String(reply).slice(0, 60)}…"`,
  });
}

// backward-compat stub
function logModeration(chatId, userId, action, reason) {
  logger.info(`[MOD] Chat:${chatId} User:${userId} Action:${action} Reason:${reason}`);
}

module.exports = {
  init,
  logEvent,
  logCommand,
  logNsfw,
  logLinkRemoved,
  logChatbot,
  logModeration,
};
