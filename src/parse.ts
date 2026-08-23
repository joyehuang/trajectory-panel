import {
  emptyUsage,
  type Session,
  type SessionMeta,
  type TimelineEvent,
  type ToolCallEvent,
  type TokenUsage,
} from './types';

// --- Raw JSONL line shapes, as written by pi's session recorder ---------

interface RawContentBlockThinking {
  type: 'thinking';
  thinking: string;
}
interface RawContentBlockText {
  type: 'text';
  text: string;
}
interface RawContentBlockToolCall {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: unknown;
}
type RawContentBlock =
  | RawContentBlockThinking
  | RawContentBlockText
  | RawContentBlockToolCall
  | { type: string; [k: string]: unknown };

interface RawUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  totalTokens?: number;
  cost?: { total?: number };
}

interface RawMessage {
  role: 'user' | 'assistant' | 'toolResult' | string;
  content: RawContentBlock[] | string;
  usage?: RawUsage;
}

interface RawLineBase {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
}

interface RawSessionLine extends RawLineBase {
  type: 'session';
  id: string;
  timestamp: string;
  cwd: string;
}

interface RawModelChangeLine extends RawLineBase {
  type: 'model_change';
  provider: string;
  modelId: string;
}

interface RawThinkingLevelLine extends RawLineBase {
  type: 'thinking_level_change';
  thinkingLevel: string;
}

interface RawMessageLine extends RawLineBase {
  type: 'message';
  id: string;
  parentId: string | null;
  timestamp: string;
  message: RawMessage;
}

type RawLine =
  | RawSessionLine
  | RawModelChangeLine
  | RawThinkingLevelLine
  | RawMessageLine
  | RawLineBase;

function toUsage(raw: RawUsage | undefined): TokenUsage | undefined {
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

function addUsage(total: TokenUsage, u: TokenUsage | undefined) {
  if (!u) return;
  total.input += u.input;
  total.output += u.output;
  total.cacheRead += u.cacheRead;
  total.cacheWrite += u.cacheWrite;
  total.reasoning += u.reasoning;
  total.totalTokens += u.totalTokens;
  total.costTotal += u.costTotal;
}

function blockText(content: RawMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((c): c is RawContentBlockText => c.type === 'text')
    .map((c) => c.text)
    .join('\n\n');
}

/**
 * Parse a raw `.jsonl` session transcript into a normalized `Session`.
 *
 * Tool call ↔ tool result association: pi's transcript format does not carry
 * an explicit `tool_use_id` back-reference on `toolResult` messages — results
 * simply follow their call as separate chained messages, in the same order the
 * calls were issued. We match them positionally with a FIFO queue, which is
 * exactly how the recorder emits them (multiple toolCalls in one assistant
 * turn produce that many toolResult messages immediately after, in order).
 */
export function parseSession(raw: string, fileName: string): Session {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  const meta: SessionMeta = {
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

  const events: TimelineEvent[] = [];
  const pendingToolCalls: ToolCallEvent[] = [];

  for (const line of lines) {
    let parsed: RawLine;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    switch (parsed.type) {
      case 'session': {
        const s = parsed as RawSessionLine;
        meta.id = s.id ?? meta.id;
        meta.timestamp = s.timestamp ?? meta.timestamp;
        meta.cwd = s.cwd ?? meta.cwd;
        break;
      }
      case 'model_change': {
        const m = parsed as RawModelChangeLine;
        meta.provider = m.provider ?? meta.provider;
        meta.modelId = m.modelId ?? meta.modelId;
        events.push({
          id: parsed.id ?? crypto.randomUUID(),
          parentId: parsed.parentId ?? null,
          timestamp: parsed.timestamp ?? null,
          kind: 'system',
          label: '模型切换',
          detail: `${m.provider ?? '?'} / ${m.modelId ?? '?'}`,
        });
        break;
      }
      case 'thinking_level_change': {
        const t = parsed as RawThinkingLevelLine;
        meta.thinkingLevel = t.thinkingLevel ?? meta.thinkingLevel;
        events.push({
          id: parsed.id ?? crypto.randomUUID(),
          parentId: parsed.parentId ?? null,
          timestamp: parsed.timestamp ?? null,
          kind: 'system',
          label: '思考等级',
          detail: String(t.thinkingLevel ?? '?'),
        });
        break;
      }
      case 'message': {
        const m = parsed as RawMessageLine;
        const msg = m.message;
        const usage = toUsage(msg.usage);
        if (usage) addUsage(meta.usageTotal, usage);

        if (msg.role === 'user') {
          const text = blockText(msg.content);
          meta.turnCount += 1;
          events.push({
            id: m.id,
            parentId: m.parentId,
            timestamp: m.timestamp,
            kind: 'user',
            text,
            usage,
          });
        } else if (msg.role === 'toolResult') {
          const text = blockText(msg.content);
          const isError = /^error\b/i.test(text.trim()) || /\bexit(ed)? (with )?code [1-9]/i.test(text);
          const call = pendingToolCalls.shift();
          if (call) {
            call.result = { text, isError };
            call.status = isError ? 'error' : 'ok';
            call.resultTimestamp = m.timestamp;
          } else {
            // No pending call to attach to (unusual/edge case) — surface it as
            // its own event rather than silently dropping data.
            events.push({
              id: m.id,
              parentId: m.parentId,
              timestamp: m.timestamp,
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
            if (block.type === 'thinking') {
              events.push({
                id: blockId,
                parentId: i === 0 ? m.parentId : `${m.id}:${i - 1}`,
                timestamp: m.timestamp,
                kind: 'thinking',
                text: (block as RawContentBlockThinking).thinking,
                usage: isLast ? usage : undefined,
              });
            } else if (block.type === 'text') {
              events.push({
                id: blockId,
                parentId: i === 0 ? m.parentId : `${m.id}:${i - 1}`,
                timestamp: m.timestamp,
                kind: 'assistant_text',
                text: (block as RawContentBlockText).text,
                usage: isLast ? usage : undefined,
              });
            } else if (block.type === 'toolCall') {
              const tc = block as RawContentBlockToolCall;
              meta.toolCallCount += 1;
              const ev: ToolCallEvent = {
                id: blockId,
                parentId: i === 0 ? m.parentId : `${m.id}:${i - 1}`,
                timestamp: m.timestamp,
                kind: 'tool_call',
                toolCallId: tc.id,
                name: tc.name,
                arguments: tc.arguments,
                status: 'pending',
                result: null,
                resultTimestamp: null,
                usage: isLast ? usage : undefined,
              };
              events.push(ev);
              pendingToolCalls.push(ev);
            }
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return { meta, events };
}
