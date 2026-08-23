// Domain model for a pi agent session trajectory.
//
// This is deliberately decoupled from the raw JSONL wire format (see parse.ts).
// A future v2 WebSocket ingestion layer can produce the same `Session` /
// `TimelineEvent` shapes incrementally (append events to a live session) without
// touching any rendering code — that's the seam this file exists to draw.

export type EventKind =
  | 'user'
  | 'thinking'
  | 'tool_call'
  | 'assistant_text'
  | 'system';

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  totalTokens: number;
  costTotal: number;
}

export type ToolStatus = 'pending' | 'ok' | 'error';

export interface ToolResult {
  text: string;
  isError: boolean;
}

export interface BaseEvent {
  id: string;
  parentId: string | null;
  timestamp: string | null;
  kind: EventKind;
  /** Token usage reported on the assistant message this event was extracted from, if any. */
  usage?: TokenUsage;
}

export interface UserEvent extends BaseEvent {
  kind: 'user';
  text: string;
}

export interface ThinkingEvent extends BaseEvent {
  kind: 'thinking';
  text: string;
}

export interface ToolCallEvent extends BaseEvent {
  kind: 'tool_call';
  toolCallId: string;
  name: string;
  arguments: unknown;
  status: ToolStatus;
  result: ToolResult | null;
  /** Timestamp the matching toolResult message arrived, if any — enables duration display. */
  resultTimestamp: string | null;
}

export interface AssistantTextEvent extends BaseEvent {
  kind: 'assistant_text';
  text: string;
}

export interface SystemEvent extends BaseEvent {
  kind: 'system';
  label: string;
  detail: string;
}

export type TimelineEvent =
  | UserEvent
  | ThinkingEvent
  | ToolCallEvent
  | AssistantTextEvent
  | SystemEvent;

export interface SessionMeta {
  /** Stable identity of the session, from the `session` event's `id` field. */
  id: string;
  /** Source filename (or user-picked file name), used as a fallback display key. */
  fileName: string;
  timestamp: string | null;
  cwd: string | null;
  provider: string | null;
  modelId: string | null;
  thinkingLevel: string | null;
  turnCount: number;
  toolCallCount: number;
  usageTotal: TokenUsage;
}

export interface Session {
  meta: SessionMeta;
  events: TimelineEvent[];
}

export function emptyUsage(): TokenUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    totalTokens: 0,
    costTotal: 0,
  };
}
