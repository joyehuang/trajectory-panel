const SHORTCUTS: [string, string][] = [
  ['/', '聚焦当前会话搜索'],
  ['⌘/Ctrl K', '打开全局命令面板'],
  ['j / k', '在事件间移动焦点'],
  ['e', '展开 / 收起聚焦的事件'],
  ['Esc', '关闭面板 / 清空搜索'],
  ['?', '显示此帮助'],
];

export function KeyboardHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="键盘快捷键"
      className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] text-zinc-600 border border-zinc-800/80 hover:text-zinc-300 hover:border-zinc-700 transition-colors cursor-pointer shrink-0"
    >
      ?
    </button>
  );
}

export function KeyboardHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#111116] shadow-2xl shadow-black/50 overflow-hidden animate-fade-rise">
        <div className="px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
          <span className="text-[13px] font-medium text-zinc-100">键盘快捷键</span>
          <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:bg-zinc-900 cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-900/60">
              <span className="text-[12.5px] text-zinc-400">{desc}</span>
              <kbd className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
