import { forwardRef } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(function SearchBox(
  { value, onChange, placeholder = '搜索…（/）' },
  ref,
) {
  return (
    <div className="relative min-w-0 flex-1 md:flex-none md:w-60">
      <svg
        viewBox="0 0 24 24"
        className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-[12px] bg-zinc-900/70 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-800 focus:ring-1 focus:ring-sky-800/60 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded flex items-center justify-center text-zinc-600 hover:text-zinc-300 cursor-pointer"
          aria-label="清空搜索"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
});
