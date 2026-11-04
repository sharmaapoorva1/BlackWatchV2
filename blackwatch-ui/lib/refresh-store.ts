// Tiny external store shared by <AutoRefresh> (the page's poller) and
// <RefreshStatus> (the visible "updated Ns ago / pause" control in the shell).
// Module state is per browser tab, never per request: it is only touched from
// client components after mount.

export interface RefreshState {
  /** A page on screen is currently polling. */
  active: boolean;
  intervalMs: number;
  /** Epoch ms of the last refresh request, or null before the first one. */
  lastRefreshAt: number | null;
  paused: boolean;
}

const INITIAL: RefreshState = { active: false, intervalMs: 0, lastRefreshAt: null, paused: false };

let state: RefreshState = INITIAL;
const listeners = new Set<() => void>();

export function getRefreshState(): RefreshState {
  return state;
}

export function getServerRefreshState(): RefreshState {
  return INITIAL;
}

export function subscribeRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function patchRefreshState(patch: Partial<RefreshState>): void {
  const next = { ...state, ...patch };
  const changed = (Object.keys(next) as (keyof RefreshState)[]).some((key) => next[key] !== state[key]);
  if (!changed) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
