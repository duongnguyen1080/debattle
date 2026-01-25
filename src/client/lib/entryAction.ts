export type EntryAction = 'start' | 'achievements';

const ENTRY_ACTION_STORAGE_KEY = 'debattle:entryAction';

export const setEntryAction = (action: EntryAction): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(ENTRY_ACTION_STORAGE_KEY, action);
};

export const consumeEntryAction = (): EntryAction | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.localStorage.getItem(ENTRY_ACTION_STORAGE_KEY);
  if (value !== 'start' && value !== 'achievements') {
    return null;
  }
  window.localStorage.removeItem(ENTRY_ACTION_STORAGE_KEY);
  return value;
};
