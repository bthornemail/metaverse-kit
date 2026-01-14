export const STATE256_EMPTY = "Ø";
export const STATE256_META_SLOT = 255;

export interface State256Meta {
  projection?: string;
  tile_id?: string;
  at_event?: string;
  state256_root?: string;
}

export type State256State = string[];

export interface Projection<T> {
  name: string;
  mux(input: T): State256State;
  demux(state: State256State): T;
}

export function createEmptyState(): State256State {
  return Array.from({ length: 256 }, () => STATE256_EMPTY);
}

export function cloneState(state: State256State): State256State {
  return [...state];
}

export function setState256Meta(state: State256State, meta: State256Meta): void {
  state[STATE256_META_SLOT] = JSON.stringify(meta);
}

export function getState256Meta(state: State256State): State256Meta | null {
  const raw = state[STATE256_META_SLOT];
  if (!raw || raw === STATE256_EMPTY) return null;
  try {
    return JSON.parse(raw) as State256Meta;
  } catch {
    return null;
  }
}
