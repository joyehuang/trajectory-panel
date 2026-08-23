import type { Session } from '../types';
import { fmtDateTime, fmtDuration, fmtNumber, fmtCost } from './format';
import { sessionDurationMs } from './duration';

function fence(text: string, lang = ''): string {
  const body = text.length > 4000 ? `${text.slice(0, 4000)}\n… (truncated)` : text;
  return `\`\`\`${lang}\n${body}\n\`\`\``;
}

/** Renders a session as a readable Markdown transcript — thinking collapsed, tool calls summarized. */
export function sessionToMarkdown(session: Session): string {
  const { meta } = session;
  const lines: string[] = [];
  lines.push(`# 会话记录`);
  lines.push('');
  lines.push(`- **模型**: ${meta.modelId ?? '未知'}`);
  lines.push(`- **时间**: ${fmtDateTime(meta.timestamp)}`);
  lines.push(`- **轮次**: ${meta.turnCount} · **工具调用**: ${meta.toolCallCount}`);
  if (meta.usageTotal.totalTokens > 0) {
    lines.push(`- **Token**: ${fmtNumber(meta.usageTotal.totalTokens)}${meta.usageTotal.costTotal > 0 ? ` · ${fmtCost(meta.usageTotal.costTotal)}` : ''}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const e of session.events) {
    switch (e.kind) {
      case 'user':
        lines.push(`## 👤 用户`);
        lines.push('');
        lines.push(e.text);
        lines.push('');
        break;
      case 'thinking':
        lines.push('<details>');
        lines.push('<summary>💭 思考</summary>');
        lines.push('');
        lines.push(e.text);
        lines.push('');
        lines.push('</details>');
        lines.push('');
        break;
      case 'assistant_text':
        lines.push(`## 🤖 助手`);
        lines.push('');
        lines.push(e.text);
        lines.push('');
        break;
      case 'tool_call': {
        lines.push(`### 🔧 \`${e.name}\` ${e.status === 'error' ? '❌' : e.status === 'ok' ? '✅' : '⏳'}`);
        lines.push('');
        lines.push('参数：');
        lines.push(fence(JSON.stringify(e.arguments, null, 2) ?? '{}', 'json'));
        if (e.result) {
          lines.push('');
          lines.push(e.result.isError ? '错误：' : '结果：');
          lines.push(fence(e.result.text || '(空)'));
        }
        lines.push('');
        break;
      }
      case 'system':
        lines.push(`> ⚙️ ${e.label}: ${e.detail}`);
        lines.push('');
        break;
    }
  }

  return lines.join('\n');
}

export function sessionSummaryText(session: Session): string {
  const { meta } = session;
  const dur = sessionDurationMs(session);
  const parts = [
    `会话 ${fmtDateTime(meta.timestamp)}`,
    meta.modelId ? `模型 ${meta.modelId}` : null,
    dur !== null ? `时长 ${fmtDuration(dur)}` : null,
    `${meta.turnCount} 轮`,
    `${meta.toolCallCount} 次工具调用`,
    meta.usageTotal.totalTokens > 0 ? `${fmtNumber(meta.usageTotal.totalTokens)} tokens` : null,
    meta.usageTotal.costTotal > 0 ? fmtCost(meta.usageTotal.costTotal) : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
