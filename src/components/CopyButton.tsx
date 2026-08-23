import { useState } from 'react';

export function CopyButton({ getText, label = '复制 JSON', className = '' }: { getText: () => string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable — silently no-op
    }
  };

  return (
    <button
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
        copied
          ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
          : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700'
      } ${className}`}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="12" height="12" rx="1.5" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      {copied ? '已复制' : label}
    </button>
  );
}
