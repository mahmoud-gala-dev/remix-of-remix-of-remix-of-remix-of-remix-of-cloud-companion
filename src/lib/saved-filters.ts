export type SavedFilter<T> = {
  id: string;
  name: string;
  value: T;
  createdAt: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function readSavedFilters<T>(key: string): SavedFilter<T>[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]") as SavedFilter<T>[];
  } catch {
    return [];
  }
}

export function saveFilter<T>(key: string, name: string, value: T) {
  const next: SavedFilter<T> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    value,
    createdAt: new Date().toISOString(),
  };
  const filters = readSavedFilters<T>(key).filter((item) => item.name !== next.name);
  filters.unshift(next);
  window.localStorage.setItem(key, JSON.stringify(filters.slice(0, 12)));
  return next;
}

export function deleteSavedFilter<T>(key: string, id: string) {
  const filters = readSavedFilters<T>(key).filter((item) => item.id !== id);
  if (isBrowser()) window.localStorage.setItem(key, JSON.stringify(filters));
  return filters;
}
