import { useCallback, useEffect, useState } from 'react';

/** A Set<string> persisted to localStorage, e.g. for starred/pinned session ids. */
export function useLocalStorageSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {
      // storage unavailable — pin state just won't persist
    }
  }, [key, set]);

  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { set, toggle };
}
