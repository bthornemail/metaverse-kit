import { getImportBlob } from './imports';

const localUrlCache = new Map<string, string>();
const localLoadPromises = new Map<string, Promise<string | null>>();
const localSubscribers = new Map<string, Set<() => void>>();

function notifyLocal(ref: string) {
  const subs = localSubscribers.get(ref);
  if (!subs) return;
  subs.forEach((cb) => cb());
  localSubscribers.delete(ref);
}

async function loadLocalRef(ref: string): Promise<string | null> {
  const blob = await getImportBlob(ref);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  localUrlCache.set(ref, url);
  notifyLocal(ref);
  return url;
}

export function resolveRef(ref: string, onResolve?: () => void): string | null {
  if (ref.startsWith('symbol:')) {
    const name = ref.replace('symbol:', '');
    const label = name.toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
      <rect width="128" height="128" fill="none" stroke="#88a0ff" stroke-width="4"/>
      <text x="64" y="70" text-anchor="middle" font-size="18" fill="#88a0ff" font-family="monospace">${label}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  if (ref.startsWith('sha256:') || ref.startsWith('blake3:')) {
    return `/object/${encodeURIComponent(ref)}`;
  }
  if (ref.startsWith('localfile:')) {
    return ref.replace('localfile:', '');
  }
  if (ref.startsWith('local:')) {
    const cached = localUrlCache.get(ref);
    if (cached) return cached;
    if (onResolve) {
      const subs = localSubscribers.get(ref) ?? new Set();
      subs.add(onResolve);
      localSubscribers.set(ref, subs);
    }
    if (!localLoadPromises.has(ref)) {
      const promise = loadLocalRef(ref).catch(() => null);
      localLoadPromises.set(ref, promise);
    }
    return null;
  }
  return ref;
}
