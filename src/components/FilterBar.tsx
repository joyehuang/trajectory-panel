export interface Filters {
  thinking: boolean;
  tools: boolean;
  system: boolean;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

function Toggle({ label, dot, checked, onClick }: { label: string; dot: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[11px] md:text-[12px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
        checked
          ? 'border-zinc-700 bg-zinc-800/80 text-zinc-100'
          : 'border-zinc-800/60 bg-transparent text-zinc-600 hover:text-zinc-400 hover:border-zinc-800'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${checked ? dot : 'bg-zinc-700'}`} />
      {label}
    </button>
  );
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Toggle label="思考" dot="bg-indigo-400" checked={filters.thinking} onClick={() => onChange({ ...filters, thinking: !filters.thinking })} />
      <Toggle label="工具" dot="bg-violet-400" checked={filters.tools} onClick={() => onChange({ ...filters, tools: !filters.tools })} />
      <Toggle label="系统" dot="bg-zinc-400" checked={filters.system} onClick={() => onChange({ ...filters, system: !filters.system })} />
    </div>
  );
}
