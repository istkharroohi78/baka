/**
 * Groq rate-limiter — dual-API failover, circuit breaker, auto-recovery.
 *
 * Key behaviour:
 *   RPM 429  — retry once with a short fixed backoff (no endless loops)
 *   TPD 429  — fail immediately on this key, switch to the other key right now
 *   Both TPD — reject instantly; callers get a fast error, never a 90-s timeout
 *
 * Every call is also capped by CALL_TIMEOUT_MS so a hung Groq request can't
 * block the Telegraf update pipeline.
 */

const Groq   = require('groq-sdk');
const config = require('../config/index');
const logger = require('./logger');

const INTERVAL_MS        = 2500;   // 24 calls / min
const CALL_TIMEOUT_MS    = 8_000;  // hard per-call wall-clock timeout
const RPM_BACKOFF_MS     = 3_000;  // fixed wait on an RPM-429 (1 retry only)
const MAX_QUEUE          = 50;
const FAILURE_THRESHOLD  = 3;      // consecutive failures before opening circuit
const RECOVERY_INTERVAL  = 90_000; // ms between background probes
const PROBE_TIMEOUT      = 10_000;

const TPD_RESET_MS = 24 * 60 * 60 * 1000; // 24 h

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

function makeCircuit(apiKey, label) {
  return {
    label,
    groq:         apiKey ? new Groq({ apiKey }) : null,
    state:        STATE.CLOSED,
    failures:     0,
    tpdUntil:     0,   // epoch ms — key is TPD-blocked until this time
    probeTimer:   null,
    probeRunning: false,
  };
}

class GroqLimiter {
  constructor() {
    this._queue   = [];
    this._running = false;
    this._primary = makeCircuit(config.groqApiKey,  'PRIMARY');
    this._backup  = makeCircuit(config.groqApiKey2, 'BACKUP');
    this._active  = this._primary;
  }

  // ── public ───────────────────────────────────────────────────────────────────

  call(fn) {
    return new Promise((resolve, reject) => {
      const slot = this._pickSlot();
      if (!slot) {
        reject(new Error('All Groq API keys are unavailable (TPD / circuit open). Will auto-recover.'));
        return;
      }
      if (this._queue.length >= MAX_QUEUE) this._queue.shift();
      this._queue.push({ fn, resolve, reject, rpmRetried: false });
      if (!this._running) this._drain();
    });
  }

  // ── slot selection ────────────────────────────────────────────────────────────

  _pickSlot() {
    if (this._isUsable(this._active)) return this._active;

    const other = this._active === this._primary ? this._backup : this._primary;
    if (this._isUsable(other)) {
      logger.warn(`🔄 Groq failover: ${this._active.label} → ${other.label}`);
      this._active = other;
      return other;
    }
    return null;
  }

  _isUsable(slot) {
    if (!slot?.groq) return false;
    if (slot.state === STATE.OPEN) return false;
    if (slot.tpdUntil > Date.now()) return false;
    return true;
  }

  // ── drain loop ────────────────────────────────────────────────────────────────

  async _drain() {
    this._running = true;
    while (this._queue.length > 0) {
      const slot = this._pickSlot();
      if (!slot) {
        const err = new Error('All Groq API keys are unavailable. Will auto-recover.');
        while (this._queue.length > 0) this._queue.shift().reject(err);
        break;
      }
      const item = this._queue.shift();
      await this._execute(item, slot);
      if (this._queue.length > 0) await _sleep(INTERVAL_MS);
    }
    this._running = false;
  }

  // ── execute one call ──────────────────────────────────────────────────────────

  async _execute(item, slot) {
    try {
      const result = await Promise.race([
        item.fn(slot.groq),
        _timeout(CALL_TIMEOUT_MS, `Groq [${slot.label}] call timed out after ${CALL_TIMEOUT_MS}ms`),
      ]);
      this._onSuccess(slot);
      item.resolve(result);
    } catch (err) {
      if (_isTPD(err)) {
        // Tokens-per-day exhausted — no retrying helps; block this key and switch
        const resetIn = _tpdResetMs(err);
        slot.tpdUntil = Date.now() + resetIn;
        logger.warn(`Groq [${slot.label}] TPD exhausted — blocking key for ${Math.round(resetIn / 60000)} min`);

        // Try the other key immediately
        const other = slot === this._primary ? this._backup : this._primary;
        if (this._isUsable(other)) {
          this._active = other;
          logger.info(`🔄 Groq TPD failover → ${other.label}`);
          this._queue.unshift(item); // re-queue for the other key
        } else {
          logger.error('Both Groq keys are TPD-exhausted. Failing fast.');
          item.reject(err);
        }
      } else if (_isRPM(err) && !item.rpmRetried) {
        // Rate-per-minute — one short retry, then give up
        item.rpmRetried = true;
        logger.warn(`Groq [${slot.label}] RPM 429 — one retry in ${RPM_BACKOFF_MS}ms`);
        await _sleep(RPM_BACKOFF_MS);
        this._queue.unshift(item);
      } else {
        this._onFailure(slot, err);
        item.reject(err);
      }
    }
  }

  // ── circuit state ─────────────────────────────────────────────────────────────

  _onSuccess(slot) {
    if (slot.state !== STATE.CLOSED) logger.info(`✅ Groq [${slot.label}] recovered — circuit CLOSED.`);
    slot.failures = 0;
    slot.state    = STATE.CLOSED;
    this._clearProbe(slot);
    if (slot === this._backup && this._isUsable(this._primary)) {
      this._active = this._primary;
      logger.info('🔄 Groq failback → PRIMARY');
    }
  }

  _onFailure(slot, err) {
    slot.failures++;
    logger.warn(`Groq [${slot.label}] failure ${slot.failures}/${FAILURE_THRESHOLD}: ${err.message?.slice(0, 120)}`);
    if (slot.failures >= FAILURE_THRESHOLD && slot.state === STATE.CLOSED) {
      slot.state = STATE.OPEN;
      logger.error(`⚡ Groq [${slot.label}] circuit OPEN — probing every ${RECOVERY_INTERVAL / 1000}s`);
      this._scheduleProbe(slot);
    }
  }

  // ── background probe ──────────────────────────────────────────────────────────

  _scheduleProbe(slot) {
    this._clearProbe(slot);
    slot.probeTimer = setTimeout(() => this._probe(slot), RECOVERY_INTERVAL);
  }

  _clearProbe(slot) {
    if (slot.probeTimer) { clearTimeout(slot.probeTimer); slot.probeTimer = null; }
  }

  async _probe(slot) {
    if (slot.probeRunning || !slot.groq) return;
    slot.probeRunning = true;
    slot.state = STATE.HALF_OPEN;
    logger.info(`🔍 Groq [${slot.label}] probing…`);
    try {
      await Promise.race([
        slot.groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        _timeout(PROBE_TIMEOUT, 'probe timeout'),
      ]);
      slot.probeRunning = false;
      this._onSuccess(slot);
      if (!this._running && this._queue.length > 0) this._drain();
    } catch (err) {
      slot.probeRunning = false;
      slot.state = STATE.OPEN;
      logger.warn(`Groq [${slot.label}] probe failed: ${err.message?.slice(0, 80)}`);
      this._scheduleProbe(slot);
    }
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function _is429(err) {
  return err?.status === 429 || String(err?.message).includes('429');
}

function _isTPD(err) {
  const msg = String(err?.message || '');
  return _is429(err) && (
    msg.includes('tokens per day') ||
    msg.includes('TPD') ||
    (msg.includes('Limit 100000') && msg.includes('Used 99'))
  );
}

function _isRPM(err) {
  return _is429(err) && !_isTPD(err);
}

function _tpdResetMs(err) {
  const match = String(err?.message).match(/try again in\s+([\d.]+)([smh])/i);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const ms = unit === 'h' ? val * 3600000 : unit === 'm' ? val * 60000 : val * 1000;
    return ms + 5000;
  }
  return TPD_RESET_MS;
}

function _timeout(ms, msg) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}

function _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = new GroqLimiter();
