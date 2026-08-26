const { Group } = require('../models');

const cache = new Map();
const TTL = 30_000;

async function getGroup(chatId) {
  const cached = cache.get(chatId);
  if (cached && cached.at > Date.now() - TTL) return cached.doc;
  let doc = await Group.findOne({ chatId });
  if (!doc) doc = await Group.create({ chatId });
  cache.set(chatId, { doc, at: Date.now() });
  return doc;
}

function invalidate(chatId) { cache.delete(chatId); }

async function updateGroup(chatId, update) {
  const doc = await Group.findOneAndUpdate({ chatId }, update, { new: true, upsert: true });
  cache.set(chatId, { doc, at: Date.now() });
  return doc;
}

module.exports = { getGroup, updateGroup, invalidate };
