// Redaction rules ported 1:1 from scripts/generate-samples.py — keep both in sync.
//
// TOKEN_RE catches Telegram-style bot tokens (<digits>:<30+ url-safe chars>).
// KEY_RE catches common API key shapes (sk-, ghp_, AKIA, xox*, Bearer ..., cfat_/r2_/vca_, api_key=...).
// SECRET_WORD_RE masks field-name-shaped secrets even when the value itself didn't match above.

const TOKEN_RE = /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g;

const KEY_RE =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|cfat_[A-Za-z0-9]{20,}|r2_[A-Za-z0-9]{20,}|vca_[A-Za-z0-9]{20,}|api[_-]?key['"]?\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,})\b/g;

const SECRET_WORD_RE = /\b(botToken|appSecret|clientSecret|apiSecret|accessToken)\b/gi;

const MAX_THINKING = 4000;
const MAX_ASSISTANT = 5000;
const MAX_RESULT = 4000;
const MAX_TOOL_ARG_STRING = 400;
const MAX_TOOL_ARG_JSON = 1200;

function redactText(text) {
  if (!text) return text;
  let out = text.replace(TOKEN_RE, '<redacted:token>');
  out = out.replace(KEY_RE, '<redacted:key>');
  out = out.replace(SECRET_WORD_RE, (m) => `${m.slice(0, 3)}***`);
  return out;
}

function truncate(text, limit, marker = '…[truncated]') {
  if (typeof text !== 'string' || text.length <= limit) return text;
  return text.slice(0, limit) + marker;
}

/** Redacts + truncates a single assistant content block (thinking / text / toolCall). */
function scrubBlock(block) {
  if (!block || typeof block !== 'object') return block;
  const b = { ...block };
  if (b.type === 'thinking' && typeof b.thinking === 'string') {
    b.thinking = truncate(redactText(b.thinking), MAX_THINKING);
  } else if (b.type === 'text' && typeof b.text === 'string') {
    b.text = truncate(redactText(b.text), MAX_ASSISTANT);
  } else if (b.type === 'toolCall') {
    const args = b.arguments;
    if (args && typeof args === 'object' && !Array.isArray(args)) {
      const out = {};
      for (const [k, v] of Object.entries(args)) {
        if (typeof v === 'string') {
          out[k] = truncate(redactText(v), MAX_TOOL_ARG_STRING);
        } else if (v && typeof v === 'object') {
          out[k] = truncate(redactText(JSON.stringify(v)), MAX_TOOL_ARG_JSON);
        } else {
          out[k] = v;
        }
      }
      b.arguments = out;
    } else if (typeof args === 'string') {
      b.arguments = truncate(redactText(args), MAX_TOOL_ARG_JSON);
    }
  }
  return b;
}

/**
 * Redacts a single parsed JSONL line (the raw `pi` wire format — session /
 * model_change / thinking_level_change / message). Non-message lines pass
 * through unchanged. Usage/cost data is preserved here — it's stripped
 * separately (see stripUsageForPublish) only for the copy that goes public.
 */
function redactRawLine(obj) {
  if (!obj || obj.type !== 'message' || !obj.message) return obj;
  const msg = { ...obj.message };
  const content = msg.content;
  if (Array.isArray(content)) {
    msg.content = content.map(scrubBlock);
  } else if (typeof content === 'string') {
    msg.content = truncate(redactText(content), MAX_RESULT);
  }
  return { ...obj, message: msg };
}

/** Drops token-usage/cost data — mirrors generate-samples.py, applied only to the publicly-synced copy. */
function stripUsageForPublish(obj) {
  if (!obj || obj.type !== 'message' || !obj.message) return obj;
  const msg = { ...obj.message };
  delete msg.usage;
  return { ...obj, message: msg };
}

/** True if `text` still contains anything that looks like a live secret — used for self-checks. */
function containsSecret(text) {
  if (!text) return false;
  TOKEN_RE.lastIndex = 0;
  KEY_RE.lastIndex = 0;
  return TOKEN_RE.test(text) || KEY_RE.test(text);
}

module.exports = { redactRawLine, stripUsageForPublish, redactText, truncate, containsSecret };
