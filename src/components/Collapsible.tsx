import { highlightText } from '../utils/highlight';

interface CollapsibleTextProps {
  text: string;
  expanded: boolean;
  onToggle: () => void;
  previewLength?: number;
  mono?: boolean;
  className?: string;
  highlight?: string;
}

/** Truncates long text to a preview with a smooth expand/collapse toggle. */
export function CollapsibleText({
  text,
  expanded,
  onToggle,
  previewLength = 200,
  mono = false,
  className = '',
  highlight = '',
}: CollapsibleTextProps) {
  const isLong = text.length > previewLength;
  const head = isLong ? text.slice(0, previewLength) : text;
  const rest = isLong ? text.slice(previewLength) : '';
  const preClass = `whitespace-pre-wrap break-words leading-relaxed ${mono ? 'font-mono text-[12px] md:text-[12.5px]' : 'text-[12.5px] md:text-[13px]'}`;

  return (
    <div className={className}>
      <pre className={preClass}>
        {highlight ? highlightText(head, highlight) : head}
        {!expanded && isLong && <span className="text-zinc-600">…</span>}
      </pre>
      {isLong && (
        <div className={`grid-rows-expand ${expanded ? 'is-open' : ''}`}>
          <div>
            <pre className={preClass}>{highlight ? highlightText(rest, highlight) : rest}</pre>
          </div>
        </div>
      )}
      {isLong && (
        <button
          onClick={onToggle}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <svg
            viewBox="0 0 24 24"
            className={`w-2.5 h-2.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="currentColor"
          >
            <path d="M12 15.5 5 8.5l1.4-1.4L12 12.7l5.6-5.6L19 8.5z" />
          </svg>
          {expanded ? '收起' : `展开全部（${text.length} 字符）`}
        </button>
      )}
    </div>
  );
}
