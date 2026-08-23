// Incremental mirror of ../../src/parse.ts — same TimelineEvent / SessionMeta shapes,
// but built line-by-line as new bytes arrive instead of all at once. Keep the two in sync.

const { redactRawLine } = require('./redact');
const crypto = require('node:crypto');

function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, costTotal: 0 };
}

function toUsage(raw) {
  if (!raw) return undefined;
  return {
    input: raw.input ?? 0,
    output: raw.output ?? 0,
    cacheRead: raw.cacheRead ?? 0,
    cacheWrite: raw.cacheWrite ?? 0,
    reasoning: raw.reasoning ?? 0,
    totalTokens: raw.totalTokens ?? 0,
    costTotal: raw.cost?.total ?? 0,
  };
}

function addUsage(total, u) {
  if (!u) return;
  total.input += u.input;
  total.output += u.output;
  total.cacheRead += u.cacheRead;
  total.cacheWrite += u.cacheWrite;
  total.reasoning += u.reasoning;
  total.totalTokens += u.totalTokens;
  total.costTotal += u.costTotal;
}

function blockText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c && c.type === 'text')
    .map((c) => c.text)
    .join('\n\n');
}

/** Stateful incremental parser for one session file — call ingestLine() per new JSONL line. */
class SessionState {
  constructor(fileName) {
    this.meta = {
      id: fileName,
      fileName,
      timestamp: null,
      cwd: null,
      provider: null,
      modelId: null,
      thinkingLevel: null,
      turnCount: 0,
      toolCallCount: 0,
      usageTotal: emptyUsage(),
    };
    this.events = [];
    this.pendingToolCalls = [];
  }

  /** Redacts + ingests one raw JSONL line; returns the events newly appended (0..n), or []. */
  ingestLine(rawLine) {
    const trimmed = rawLine.trim();
    if (!trimmed) return [];
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
    parsed = redactRawLine(parsed);
    return this.ingestParsed(parsed);
  }

  ingestParsed(parsed) {
    // Emitted holds every event that is new *or* mutated by this line (e.g. a
    // toolResult attaching to an already-emitted tool_call) — a plain
    // before/after length diff on this.events would miss in-place mutations.
    const emitted = [];
    const meta = this.meta;
    const push = (ev) => {
      this.events.push(ev);
      emitted.push(ev);
    };

    switch (parsed.type) {
      case 'session': {
        meta.id = parsed.id ?? meta.id;
        meta.timestamp = parsed.timestamp ?? meta.timestamp;
        meta.cwd = parsed.cwd ?? meta.cwd;
        break;
      }
      case 'model_change': {
        meta.provider = parsed.provider ?? meta.provider;
        meta.modelId = parsed.modelId ?? meta.modelId;
        push({
          id: parsed.id ?? crypto.randomUUID(),
          parentId: parsed.parentId ?? null,
          timestamp: parsed.timestamp ?? null,
          kind: 'system',
          label: '模型切换',
          detail: `${parsed.provider ?? '?'} / ${parsed.modelId ?? '?'}`,
        });
        break;
      }
      case 'thinking_level_change': {
        meta.thinkingLevel = parsed.thinkingLevel ?? meta.thinkingLevel;
        push({
          id: parsed.id ?? crypto.randomUUID(),
          parentId: parsed.parentId ?? null,
          timestamp: parsed.timestamp ?? null,
          kind: 'system',
          label: '思考等级',
          detail: String(parsed.thinkingLevel ?? '?'),
        });
        break;
      }
      case 'message': {
        const m = parsed;
        const msg = m.message || {};
        const usage = toUsage(msg.usage);
        if (usage) addUsage(meta.usageTotal, usage);

        if (msg.role === 'user') {
          const text = blockText(msg.content);
          meta.turnCount += 1;
          push({ id: m.id, parentId: m.parentId ?? null, timestamp: m.timestamp ?? null, kind: 'user', text, usage });
        } else if (msg.role === 'toolResult') {
          const text = blockText(msg.content);
          const isError = /^error\b/i.test(text.trim()) || /\bexit(ed)? (with )?code [1-9]/i.test(text);
          const call = this.pendingToolCalls.shift();
          if (call) {
            call.result = { text, isError };
            call.status = isError ? 'error' : 'ok';
            call.resultTimestamp = m.timestamp ?? null;
            // Not a new event, but the client's copy of it is now stale — re-emit
            // the mutated tool_call so `update` messages carry the result too.
            emitted.push(call);
          } else {
            push({
              id: m.id,
              parentId: m.parentId ?? null,
              timestamp: m.timestamp ?? null,
              kind: 'assistant_text',
              text: `[未匹配的工具结果]\n${text}`,
              usage,
            });
          }
        } else if (msg.role === 'assistant') {
          const blocks = Array.isArray(msg.content) ? msg.content : [];
          blocks.forEach((block, i) => {
            const isLast = i === blocks.length - 1;
            const blockId = `${m.id}:${i}`;
            const parentId = i === 0 ? (m.parentId ?? null) : `${m.id}:${i - 1}`;
            if (block.type === 'thinking') {
              push({ id: blockId, parentId, timestamp: m.timestamp ?? null, kind: 'thinking', text: block.thinking, usage: isLast ? usage : undefined });
            } else if (block.type === 'text') {
              push({ id: blockId, parentId, timestamp: m.timestamp ?? null, kind: 'assistant_text', text: block.text, usage: isLast ? usage : undefined });
            } else if (block.type === 'toolCall') {
              meta.toolCallCount += 1;
              const ev = {
                id: blockId,
                parentId,
                timestamp: m.timestamp ?? null,
                kind: 'tool_call',
                toolCallId: block.id,
                name: block.name,
                arguments: block.arguments,
                status: 'pending',
                result: null,
                resultTimestamp: null,
                usage: isLast ? usage : undefined,
              };
              push(ev);
              this.pendingToolCalls.push(ev);
            }
          });
        }
        break;
      }
      default:
        break;
    }

    return emitted;
  }

  toSession() {
    return { meta: this.meta, events: this.events };
  }
}

module.exports = { SessionState };
